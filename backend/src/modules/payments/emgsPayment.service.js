const crypto = require('crypto');
const fs = require('fs');
const prisma = require('../../config/database');
const { uploadToDrive } = require('../../services/driveUpload');

const NOT_REQUIRED_REASONS = new Set([
  'UNIVERSITY_HANDLES_EMGS', 'EMGS_ALREADY_PAID', 'NOT_APPLICABLE',
  'SCHOLARSHIP_OR_SPONSORSHIP', 'STUDENT_WITHDRAWN', 'OTHER',
]);

function money(value, field = 'amount') {
  const raw = String(value ?? '').trim();
  if (!/^\d{1,10}(?:\.\d{1,2})?$/.test(raw) || BigInt(raw.replace('.', '').padEnd(raw.includes('.') ? raw.length + (2 - raw.split('.')[1].length) : raw.length + 2, '0')) <= 0n) {
    throw { statusCode: 400, message: `${field} must be a positive amount with at most 2 decimal places` };
  }
  const [whole, fraction = ''] = raw.split('.');
  return `${whole}.${fraction.padEnd(2, '0')}`;
}

function cents(value) {
  const [whole, fraction = ''] = String(value ?? 0).split('.');
  return BigInt(whole || 0) * 100n + BigInt(fraction.padEnd(2, '0').slice(0, 2) || 0);
}

function decimalFromCents(value) {
  const negative = value < 0n;
  const absolute = negative ? -value : value;
  return `${negative ? '-' : ''}${absolute / 100n}.${String(absolute % 100n).padStart(2, '0')}`;
}

function currency(value) {
  const result = String(value || 'MYR').trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(result)) throw { statusCode: 400, message: 'A valid 3-letter currency is required' };
  return result;
}

function maskAccountNumber(value) {
  const clean = String(value || '').replace(/\s+/g, '');
  if (clean.length < 4) throw { statusCode: 400, message: 'A valid account number is required' };
  return `•••• ${clean.slice(-4)}`;
}

function encryptionKey() {
  const secret = process.env.PAYMENT_ACCOUNT_ENCRYPTION_KEY;
  if (!secret || secret.length < 32) throw { statusCode: 500, message: 'Payment account encryption is not configured' };
  return crypto.createHash('sha256').update(secret).digest();
}

function protectAccountNumber(value) {
  const iv = crypto.randomBytes(12); const cipher = crypto.createCipheriv('aes-256-gcm', encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(String(value), 'utf8'), cipher.final()]);
  return `v1:${iv.toString('base64')}:${cipher.getAuthTag().toString('base64')}:${encrypted.toString('base64')}`;
}

function revealAccountNumber(value) {
  if (!String(value || '').startsWith('v1:')) return String(value || '');
  const [, iv, tag, payload] = value.split(':'); const decipher = crypto.createDecipheriv('aes-256-gcm', encryptionKey(), Buffer.from(iv, 'base64'));
  decipher.setAuthTag(Buffer.from(tag, 'base64')); return Buffer.concat([decipher.update(Buffer.from(payload, 'base64')), decipher.final()]).toString('utf8');
}

function publicAccount(row) {
  if (!row) return null;
  const { accountNumber, ...safe } = row;
  return safe;
}

function snapshot(account, universityName) {
  return {
    accountType: account.accountType,
    accountLabel: account.label,
    accountHolderName: account.accountHolderName,
    bankName: account.bankName,
    maskedAccountNumber: account.maskedAccountNumber,
    protectedAccountNumber: account.accountNumber,
    currency: account.currency,
    branchName: account.branchName,
    swiftBic: account.swiftBic,
    iban: account.iban,
    routingNumber: account.routingNumber,
    paymentInstructions: account.paymentInstructions,
    universityName: universityName || null,
    capturedAt: new Date().toISOString(),
  };
}

async function applicationForTenant(applicationId, tenantId) {
  const app = await prisma.application.findFirst({
    where: { id: applicationId, tenantId, deletedAt: null },
    include: { student: true, university: true },
  });
  if (!app) throw { statusCode: 404, message: 'Application not found' };
  return app;
}

async function audit(tx, { tenantId, actorId, entityType, entityId, action, oldValue, newValue, reason }) {
  return tx.financialAuditLog.create({ data: { tenantId, actorId, entityType, entityId, action, oldValue, newValue, reason } });
}

async function listAccounts(tenantId, query = {}) {
  const accountType = query.accountType || undefined;
  const where = {
    tenantId,
    archivedAt: null,
    ...(accountType && { accountType }),
    ...(query.currency && { currency: currency(query.currency) }),
    // University scoping applies only to university-owned accounts. Tenant and
    // other destination accounts are shared within the tenant and store null.
    ...(accountType === 'UNIVERSITY_ACCOUNT' && query.universityId && { universityId: query.universityId }),
    ...(query.includeInactive !== 'true' && { isActive: true }),
  };
  return (await prisma.paymentDestinationAccount.findMany({ where, orderBy: [{ isDefault: 'desc' }, { label: 'asc' }] })).map(publicAccount);
}

async function createAccount(tenantId, actorId, data) {
  const accountType = String(data.accountType || '');
  const allowed = ['TENANT_ACCOUNT', 'UNIVERSITY_ACCOUNT', 'EMGS_ACCOUNT', 'OTHER_APPROVED_ACCOUNT'];
  if (!allowed.includes(accountType)) throw { statusCode: 400, message: 'Invalid payment account type' };
  if (accountType === 'UNIVERSITY_ACCOUNT' && !data.universityId) throw { statusCode: 400, message: 'University is required for a University Account' };
  if (data.universityId) {
    const university = await prisma.university.findFirst({ where: { id: data.universityId, tenantId } });
    if (!university) throw { statusCode: 400, message: 'University account must belong to this tenant' };
  }
  const accountCurrency = currency(data.currency);
  const masked = maskAccountNumber(data.accountNumber);
  return prisma.$transaction(async (tx) => {
    if (data.isDefault) {
      await tx.paymentDestinationAccount.updateMany({
        where: { tenantId, accountType, universityId: data.universityId || null, currency: accountCurrency, isDefault: true },
        data: { isDefault: false, updatedByUserId: actorId },
      });
    }
    const row = await tx.paymentDestinationAccount.create({ data: {
      tenantId, accountType, universityId: data.universityId || null,
      label: String(data.label || '').trim(), accountHolderName: String(data.accountHolderName || '').trim(),
      bankName: String(data.bankName || '').trim(), accountNumber: protectAccountNumber(String(data.accountNumber).replace(/\s+/g, '')),
      maskedAccountNumber: masked, currency: accountCurrency, branchName: data.branchName || null,
      swiftBic: data.swiftBic || null, iban: data.iban || null, routingNumber: data.routingNumber || null,
      paymentInstructions: data.paymentInstructions || null, isDefault: !!data.isDefault,
      createdByUserId: actorId, updatedByUserId: actorId,
    } });
    await audit(tx, { tenantId, actorId, entityType: 'PAYMENT_ACCOUNT', entityId: row.id, action: 'ACCOUNT_CREATED', newValue: publicAccount(row) });
    return publicAccount(row);
  });
}

async function updateAccount(id, tenantId, actorId, data) {
  const current = await prisma.paymentDestinationAccount.findFirst({ where: { id, tenantId, archivedAt: null } });
  if (!current) throw { statusCode: 404, message: 'Payment account not found' };
  const accountCurrency = data.currency ? currency(data.currency) : current.currency;
  const next = {
    label: data.label == null ? current.label : String(data.label).trim(),
    accountHolderName: data.accountHolderName == null ? current.accountHolderName : String(data.accountHolderName).trim(),
    bankName: data.bankName == null ? current.bankName : String(data.bankName).trim(),
    currency: accountCurrency, branchName: data.branchName ?? current.branchName,
    swiftBic: data.swiftBic ?? current.swiftBic, iban: data.iban ?? current.iban,
    routingNumber: data.routingNumber ?? current.routingNumber,
    paymentInstructions: data.paymentInstructions ?? current.paymentInstructions,
    isActive: data.isActive == null ? current.isActive : !!data.isActive,
    isDefault: data.isDefault == null ? current.isDefault : !!data.isDefault,
    updatedByUserId: actorId,
  };
  if (data.accountNumber) {
    next.accountNumber = protectAccountNumber(String(data.accountNumber).replace(/\s+/g, ''));
    next.maskedAccountNumber = maskAccountNumber(data.accountNumber);
  }
  return prisma.$transaction(async (tx) => {
    if (next.isDefault) await tx.paymentDestinationAccount.updateMany({ where: { tenantId, id: { not: id }, accountType: current.accountType, universityId: current.universityId, currency: accountCurrency, isDefault: true }, data: { isDefault: false, updatedByUserId: actorId } });
    const row = await tx.paymentDestinationAccount.update({ where: { id }, data: next });
    await audit(tx, { tenantId, actorId, entityType: 'PAYMENT_ACCOUNT', entityId: id, action: 'ACCOUNT_UPDATED', oldValue: publicAccount(current), newValue: publicAccount(row) });
    return publicAccount(row);
  });
}

async function archiveAccount(id, tenantId, actorId) {
  const current = await prisma.paymentDestinationAccount.findFirst({ where: { id, tenantId, archivedAt: null } });
  if (!current) throw { statusCode: 404, message: 'Payment account not found' };
  const activeFee = await prisma.emgsFeeItem.findFirst({ where: { tenantId, destinationAccountId: id, status: { in: ['PAYMENT_PENDING', 'PARTIALLY_PAID'] } } });
  if (activeFee) throw { statusCode: 409, message: 'This account is used by an active payable fee and cannot be archived' };
  return prisma.$transaction(async (tx) => {
    const row = await tx.paymentDestinationAccount.update({ where: { id }, data: { isActive: false, isDefault: false, archivedAt: new Date(), updatedByUserId: actorId } });
    await audit(tx, { tenantId, actorId, entityType: 'PAYMENT_ACCOUNT', entityId: id, action: 'ACCOUNT_ARCHIVED', oldValue: publicAccount(current) });
    return publicAccount(row);
  });
}

async function revealAccount(id, tenantId) {
  const row = await prisma.paymentDestinationAccount.findFirst({ where: { id, tenantId, archivedAt: null, isActive: true } });
  if (!row) throw { statusCode: 404, message: 'Payment account not found' };
  return { ...publicAccount(row), accountNumber: revealAccountNumber(row.accountNumber) };
}

async function postpone(applicationId, tenantId, actorId) {
  const app = await applicationForTenant(applicationId, tenantId);
  if (!app.offerLetterUrl) throw { statusCode: 400, message: 'Offer Letter must be uploaded first' };
  return prisma.$transaction(async (tx) => {
    await tx.application.update({ where: { id: app.id }, data: { emgsSetupDecision: 'SET_UP_LATER', emgsSetupDecidedAt: new Date(), emgsSetupDecidedById: actorId } });
    const task = await tx.paymentWorkflowTask.upsert({
      where: { id: `emgs-setup-${app.id}` },
      create: { id: `emgs-setup-${app.id}`, tenantId, applicationId: app.id, taskType: 'SET_UP_EMGS_PAYMENT', title: 'Set up EMGS payment', createdById: actorId },
      update: { status: 'PENDING', completedAt: null, completedById: null },
    });
    await audit(tx, { tenantId, actorId, entityType: 'APPLICATION', entityId: app.id, action: 'EMGS_SETUP_POSTPONED' });
    return task;
  });
}

async function markNotRequired(applicationId, tenantId, actorId, data) {
  const app = await applicationForTenant(applicationId, tenantId);
  const reason = String(data.reason || '');
  if (!NOT_REQUIRED_REASONS.has(reason)) throw { statusCode: 400, message: 'A valid EMGS not-required reason is required' };
  if (reason === 'OTHER' && !String(data.note || '').trim()) throw { statusCode: 400, message: 'An internal note is required for Other' };
  return prisma.$transaction(async (tx) => {
    const updated = await tx.application.update({ where: { id: app.id }, data: {
      emgsPaymentStatus: 'NOT_REQUIRED', emgsSetupDecision: 'NOT_REQUIRED', emgsNotRequiredReason: reason,
      emgsNotRequiredNote: data.note || null, emgsSetupDecidedAt: new Date(), emgsSetupDecidedById: actorId,
    } });
    await tx.applicationPaymentAccount.upsert({ where: { applicationId: app.id }, create: { tenantId, studentId: app.studentId, applicationId: app.id, status: 'NOT_REQUIRED' }, update: { status: 'NOT_REQUIRED' } });
    await audit(tx, { tenantId, actorId, entityType: 'APPLICATION', entityId: app.id, action: 'EMGS_NOT_REQUIRED', newValue: { reason, note: data.note || null }, reason });
    return { applicationId: updated.id, status: updated.emgsPaymentStatus, reason };
  });
}

async function setup(applicationId, tenantId, actorId, data) {
  const app = await applicationForTenant(applicationId, tenantId);
  if (!app.offerLetterUrl) throw { statusCode: 400, message: 'Offer Letter must be uploaded before EMGS payment setup' };
  const feeAmount = money(data.amount);
  const feeCurrency = currency(data.currency);
  const dueDate = new Date(data.dueDate);
  if (Number.isNaN(dueDate.getTime())) throw { statusCode: 400, message: 'A valid due date is required' };
  const account = await prisma.paymentDestinationAccount.findFirst({ where: { id: data.destinationAccountId, tenantId, isActive: true, archivedAt: null } });
  if (!account) throw { statusCode: 400, message: 'Selected payment account is inactive or unavailable' };
  if (account.currency !== feeCurrency) throw { statusCode: 400, message: 'Payment account currency must match fee currency' };
  if (account.accountType === 'UNIVERSITY_ACCOUNT' && account.universityId !== app.universityId) throw { statusCode: 400, message: 'Selected University Account does not belong to the Application University' };
  const accountSnapshot = snapshot(account, app.university?.name);

  return prisma.$transaction(async (tx) => {
    const existing = await tx.emgsFeeItem.findUnique({ where: { activeApplicationKey: app.id } });
    if (existing) return existing;
    const ledger = await tx.applicationPaymentAccount.upsert({
      where: { applicationId: app.id },
      create: { tenantId, studentId: app.studentId, applicationId: app.id, status: 'PAYMENT_PENDING', currency: feeCurrency },
      update: { status: 'PAYMENT_PENDING', currency: feeCurrency },
    });
    const legacyPayment = await tx.payment.create({ data: {
      tenantId, studentId: app.studentId, applicationId: app.id, amount: feeAmount, currency: feeCurrency,
      status: 'PENDING', dueDate, paymentType: 'EMGS', description: data.description || 'EMGS Fee', notes: data.internalNote || null,
    } });
    const fee = await tx.emgsFeeItem.create({ data: {
      tenantId, studentId: app.studentId, applicationId: app.id, paymentAccountId: ledger.id,
      description: data.description || 'EMGS Fee', amount: feeAmount, currency: feeCurrency, dueDate,
      destinationType: account.accountType, destinationAccountId: account.id, destinationSnapshot: accountSnapshot,
      allowPartialPayment: !!data.allowPartialPayment,
      minimumPartialAmount: data.minimumPartialAmount ? money(data.minimumPartialAmount, 'minimum partial payment') : null,
      activeApplicationKey: app.id, studentVisibleNote: data.studentVisibleDescription || null,
      internalNote: data.internalNote || null, createdByUserId: actorId, legacyPaymentId: legacyPayment.id,
    } });
    let invoice = null;
    if (data.generateInvoice) {
      const invoiceId = crypto.randomUUID();
      invoice = await tx.invoice.create({ data: {
        id: invoiceId, tenantId, applicationId: app.id, studentId: app.studentId, paymentId: legacyPayment.id,
        invoiceType: 'EMGS', amount: feeAmount, subtotal: feeAmount, grandTotal: feeAmount, currency: feeCurrency,
        status: 'DRAFT', dueDate, updatedAt: new Date(), createdById: actorId,
        studentName: app.student.fullName, passportNo: app.student.passportNumber,
        studentEmail: app.student.email, studentPhone: app.student.phone,
        universityName: app.university?.name, programmeName: app.program, referenceNo: app.referenceNo,
        paymentAccountSnapshot: accountSnapshot, paymentDestinationType: account.accountType,
        destinationAccountId: account.id, emgsFeeItemId: fee.id,
      } });
      await tx.invoiceItem.create({ data: { id: crypto.randomUUID(), invoiceId, description: 'EMGS Fee', quantity: '1.00', unitPrice: feeAmount, amount: feeAmount, updatedAt: new Date() } });
      await tx.emgsFeeItem.update({ where: { id: fee.id }, data: { invoiceId } });
    }
    await tx.application.update({ where: { id: app.id }, data: { emgsPaymentStatus: 'PAYMENT_PENDING', emgsSetupDecision: 'CONFIGURED', emgsSetupDecidedAt: new Date(), emgsSetupDecidedById: actorId } });
    await tx.paymentWorkflowTask.updateMany({ where: { tenantId, applicationId: app.id, taskType: 'SET_UP_EMGS_PAYMENT', status: 'PENDING' }, data: { status: 'COMPLETED', completedById: actorId, completedAt: new Date() } });
    await audit(tx, { tenantId, actorId, entityType: 'EMGS_FEE', entityId: fee.id, action: 'EMGS_FEE_CREATED', newValue: { amount: feeAmount, currency: feeCurrency, destinationType: account.accountType, maskedAccountNumber: account.maskedAccountNumber, invoiceId: invoice?.id || null } });
    return { ...fee, invoice };
  }, { isolationLevel: 'Serializable' });
}

async function amendFee(id, tenantId, actorId, data) {
  const current = await prisma.emgsFeeItem.findFirst({ where: { id, tenantId, status: { notIn: ['CANCELLED', 'NOT_REQUIRED'] } } });
  if (!current) throw { statusCode: 404, message: 'Active EMGS fee not found' };
  const amount = data.amount == null ? String(current.amount) : money(data.amount);
  const dueDate = data.dueDate == null ? current.dueDate : new Date(data.dueDate);
  if (Number.isNaN(dueDate.getTime())) throw { statusCode: 400, message: 'A valid due date is required' };
  const verified = await prisma.emgsPaymentTransaction.findMany({ where: { tenantId, feeItemId: id, status: 'VERIFIED' }, select: { amount: true } });
  const verifiedTotal = verified.reduce((sum, row) => sum + cents(row.amount), 0n);
  if (cents(amount) < verifiedTotal) throw { statusCode: 400, message: 'Fee amount cannot be lower than the verified paid amount' };

  return prisma.$transaction(async (tx) => {
    const updated = await tx.emgsFeeItem.update({ where: { id }, data: { amount, dueDate, description: data.description == null ? current.description : String(data.description), internalNote: data.internalNote == null ? current.internalNote : data.internalNote } });
    if (current.legacyPaymentId) await tx.payment.update({ where: { id: current.legacyPaymentId }, data: { amount, dueDate, description: updated.description, notes: updated.internalNote } });
    await audit(tx, { tenantId, actorId, entityType: 'EMGS_FEE', entityId: id, action: 'EMGS_FEE_AMENDED', oldValue: { amount: String(current.amount), dueDate: current.dueDate }, newValue: { amount, dueDate } });
    await recalculate(tx, current.applicationId, tenantId);
    return updated;
  });
}

async function summary(applicationId, tenantId, includeProtected = false) {
  const app = await applicationForTenant(applicationId, tenantId);
  const [ledger, fees, transactions, receipts, reversals, tasks, invoices] = await Promise.all([
    prisma.applicationPaymentAccount.findUnique({ where: { applicationId } }),
    prisma.emgsFeeItem.findMany({ where: { tenantId, applicationId }, orderBy: { createdAt: 'desc' } }),
    prisma.emgsPaymentTransaction.findMany({ where: { tenantId, applicationId }, orderBy: { createdAt: 'desc' } }),
    prisma.emgsPaymentReceipt.findMany({ where: { tenantId, applicationId }, orderBy: { createdAt: 'desc' } }),
    prisma.emgsPaymentReversal.findMany({ where: { tenantId, applicationId }, orderBy: { createdAt: 'desc' } }),
    prisma.paymentWorkflowTask.findMany({ where: { tenantId, applicationId, status: 'PENDING' } }),
    prisma.invoice.findMany({ where: { tenantId, applicationId, invoiceType: 'EMGS', status: { not: 'CANCELLED' } }, orderBy: { createdAt: 'desc' } }),
  ]);
  const auditHistory = await prisma.financialAuditLog.findMany({ where: { tenantId, entityId: { in: [applicationId, ...fees.map((f) => f.id), ...transactions.map((t) => t.id)] } }, orderBy: { createdAt: 'desc' }, take: 100 });
  const byCurrency = {};
  for (const fee of fees.filter((row) => !['CANCELLED', 'NOT_REQUIRED'].includes(row.status))) {
    const key = fee.currency;
    byCurrency[key] ||= { currency: key, totalPayable: 0n, verifiedPaid: 0n, pendingVerification: 0n };
    byCurrency[key].totalPayable += cents(fee.amount);
  }
  for (const transaction of transactions) {
    const key = transaction.currency;
    byCurrency[key] ||= { currency: key, totalPayable: 0n, verifiedPaid: 0n, pendingVerification: 0n };
    if (transaction.status === 'VERIFIED') byCurrency[key].verifiedPaid += cents(transaction.amount);
    if (['PROOF_UPLOADED', 'UNDER_VERIFICATION'].includes(transaction.status)) byCurrency[key].pendingVerification += cents(transaction.amount);
  }
  const totals = Object.values(byCurrency).map((row) => ({
    currency: row.currency, totalPayable: decimalFromCents(row.totalPayable), verifiedPaid: decimalFromCents(row.verifiedPaid),
    pendingVerification: decimalFromCents(row.pendingVerification), outstanding: decimalFromCents(row.totalPayable - row.verifiedPaid),
  }));
  const sanitizeSnapshot = (value) => {
    if (includeProtected || !value) return value;
    const { protectedAccountNumber, ...safe } = value;
    return safe;
  };
  return {
    application: {
      id: app.id, referenceNo: app.referenceNo, status: app.status,
      offerLetterUrl: app.offerLetterUrl, emgsPaymentStatus: app.emgsPaymentStatus,
      paymentVerifiedAt: app.paymentVerifiedAt, invoiceIssuedAt: app.invoiceIssuedAt,
      university: app.university, program: app.program,
    },
    ledger, totals, fees: fees.map((f) => ({ ...f, destinationSnapshot: sanitizeSnapshot(f.destinationSnapshot) })),
    transactions: transactions.map((t) => ({ ...t, destinationSnapshot: sanitizeSnapshot(t.destinationSnapshot) })),
    receipts,
    reversals,
    tasks,
    invoices: invoices.map((invoice) => ({ ...invoice, paymentAccountSnapshot: sanitizeSnapshot(invoice.paymentAccountSnapshot) })),
    auditHistory,
  };
}

async function recalculate(tx, applicationId, tenantId) {
  const fees = await tx.emgsFeeItem.findMany({ where: { tenantId, applicationId, status: { notIn: ['CANCELLED', 'NOT_REQUIRED'] } } });
  const allocations = await tx.emgsPaymentAllocation.findMany({ where: { tenantId, feeItemId: { in: fees.map((f) => f.id) } } });
  const reversals = await tx.emgsPaymentReversal.findMany({ where: { tenantId, applicationId, status: 'COMPLETED' } });
  const payableByCurrency = new Map();
  const paidByCurrency = new Map();
  for (const fee of fees) payableByCurrency.set(fee.currency, (payableByCurrency.get(fee.currency) || 0n) + cents(fee.amount));
  for (const allocation of allocations) paidByCurrency.set(fees.find((f) => f.id === allocation.feeItemId)?.currency, (paidByCurrency.get(fees.find((f) => f.id === allocation.feeItemId)?.currency) || 0n) + cents(allocation.amount));
  for (const reversal of reversals) paidByCurrency.set(reversal.currency, (paidByCurrency.get(reversal.currency) || 0n) - cents(reversal.amount));
  let overall = 'PAYMENT_PENDING';
  for (const [code, payable] of payableByCurrency) {
    const paid = paidByCurrency.get(code) || 0n;
    const feeStatus = paid === 0n ? 'PAYMENT_PENDING' : paid < payable ? 'PARTIALLY_PAID' : paid === payable ? 'FULLY_PAID' : 'OVERPAID';
    await tx.emgsFeeItem.updateMany({ where: { tenantId, applicationId, currency: code, status: { notIn: ['CANCELLED', 'NOT_REQUIRED'] } }, data: { status: feeStatus } });
    if (feeStatus === 'OVERPAID' || overall !== 'OVERPAID' && feeStatus === 'PARTIALLY_PAID' || overall === 'PAYMENT_PENDING' && feeStatus === 'FULLY_PAID') overall = feeStatus;
  }
  if (fees.length && fees.every((f) => {
    const payable = payableByCurrency.get(f.currency) || 0n; const paid = paidByCurrency.get(f.currency) || 0n; return paid >= payable;
  })) overall = [...payableByCurrency].some(([c,p]) => (paidByCurrency.get(c) || 0n) > p) ? 'OVERPAID' : 'FULLY_PAID';
  await tx.applicationPaymentAccount.update({ where: { applicationId }, data: { status: overall } });
  await tx.application.update({ where: { id: applicationId }, data: { emgsPaymentStatus: overall } });
  return { status: overall, payableByCurrency, paidByCurrency };
}

async function submitProof(applicationId, tenantId, actorId, data, file) {
  if (!file) throw { statusCode: 400, message: 'Payment proof document is required' };
  const app = await applicationForTenant(applicationId, tenantId);
  const fee = await prisma.emgsFeeItem.findFirst({ where: { id: data.feeItemId, tenantId, applicationId, status: { in: ['PAYMENT_PENDING', 'PARTIALLY_PAID'] } } });
  if (!fee) throw { statusCode: 404, message: 'Active EMGS fee not found' };
  const amount = money(data.amount);
  if (currency(data.currency) !== fee.currency) throw { statusCode: 400, message: 'Payment currency must match the selected fee' };
  if (fee.minimumPartialAmount && cents(amount) < cents(fee.minimumPartialAmount)) throw { statusCode: 400, message: `Minimum partial payment is ${fee.minimumPartialAmount} ${fee.currency}` };
  if (!fee.allowPartialPayment && cents(amount) < cents(fee.amount)) throw { statusCode: 400, message: 'Partial payment is not allowed for this fee' };
  const proofHash = crypto.createHash('sha256').update(fs.readFileSync(file.path)).digest('hex');
  const duplicate = await prisma.emgsPaymentTransaction.findFirst({ where: { tenantId, OR: [{ proofHash }, ...(data.transactionReference ? [{ transactionReference: String(data.transactionReference).trim() }] : [])], status: { not: 'REJECTED' } } });
  if (duplicate) throw { statusCode: 409, message: 'This proof or transaction reference has already been submitted' };
  const uploaded = await uploadToDrive(file, 'emgs-payment-proof');
  return prisma.$transaction(async (tx) => {
    const row = await tx.emgsPaymentTransaction.create({ data: {
      tenantId, studentId: app.studentId, applicationId, feeItemId: fee.id, amount, currency: fee.currency,
      paymentDate: new Date(data.paymentDate), paymentMethod: String(data.paymentMethod || 'BANK_TRANSFER'), paidBy: String(data.paidBy || 'STUDENT'),
      destinationType: fee.destinationType, destinationAccountId: fee.destinationAccountId, destinationSnapshot: fee.destinationSnapshot,
      transactionReference: data.transactionReference ? String(data.transactionReference).trim() : null, note: data.note || null,
      proofFileUrl: uploaded.fileUrl, proofHash, submittedByUserId: actorId,
    } });
    await tx.applicationPaymentAccount.update({ where: { applicationId }, data: { status: 'PROOF_UPLOADED' } });
    await tx.application.update({ where: { id: applicationId }, data: { emgsPaymentStatus: 'PROOF_UPLOADED', paymentProofUrl: uploaded.fileUrl, paymentProofUploadedById: actorId, paymentProofUploadedAt: new Date() } });
    await audit(tx, { tenantId, actorId, entityType: 'EMGS_TRANSACTION', entityId: row.id, action: 'PROOF_UPLOADED', newValue: { amount, currency: fee.currency, reference: row.transactionReference, proofHash } });
    return row;
  });
}

async function startReview(id, tenantId, actorId) {
  return prisma.$transaction(async (tx) => {
    const row = await tx.emgsPaymentTransaction.findFirst({ where: { id, tenantId } });
    if (!row) throw { statusCode: 404, message: 'Payment transaction not found' };
    if (row.status !== 'PROOF_UPLOADED') throw { statusCode: 409, message: 'Only uploaded proofs can enter review' };
    const updated = await tx.emgsPaymentTransaction.update({ where: { id }, data: { status: 'UNDER_VERIFICATION' } });
    await tx.applicationPaymentAccount.update({ where: { applicationId: row.applicationId }, data: { status: 'UNDER_VERIFICATION' } });
    await tx.application.update({ where: { id: row.applicationId }, data: { emgsPaymentStatus: 'UNDER_VERIFICATION' } });
    await audit(tx, { tenantId, actorId, entityType: 'EMGS_TRANSACTION', entityId: id, action: 'VERIFICATION_STARTED' });
    return updated;
  });
}

async function verify(id, tenantId, actorId, data = {}) {
  return prisma.$transaction(async (tx) => {
    const row = await tx.emgsPaymentTransaction.findFirst({ where: { id, tenantId } });
    if (!row) throw { statusCode: 404, message: 'Payment transaction not found' };
    if (row.status === 'VERIFIED') return tx.emgsPaymentReceipt.findUnique({ where: { transactionId: id } });
    if (!['PROOF_UPLOADED', 'UNDER_VERIFICATION'].includes(row.status)) throw { statusCode: 409, message: 'This payment cannot be verified' };
    const verifiedAmount = money(data.amount || row.amount, 'verified amount');
    if (cents(verifiedAmount) > cents(row.amount)) throw { statusCode: 400, message: 'Verified amount cannot exceed submitted amount' };
    await tx.emgsPaymentAllocation.create({ data: { tenantId, transactionId: id, feeItemId: row.feeItemId, amount: verifiedAmount } });
    await tx.emgsPaymentTransaction.update({ where: { id }, data: { amount: verifiedAmount, status: 'VERIFIED', verifiedByUserId: actorId, verifiedAt: new Date() } });
    const state = await recalculate(tx, row.applicationId, tenantId);
    const payable = state.payableByCurrency.get(row.currency) || 0n; const paid = state.paidByCurrency.get(row.currency) || 0n;
    const receiptNo = `EMGS-${new Date().getUTCFullYear()}-${id.slice(0, 8).toUpperCase()}`;
    const receipt = await tx.emgsPaymentReceipt.create({ data: { tenantId, studentId: row.studentId, applicationId: row.applicationId, transactionId: id, receiptNo, amount: verifiedAmount, currency: row.currency, destinationType: row.destinationType, destinationSnapshot: row.destinationSnapshot, remainingBalance: decimalFromCents(payable - paid > 0n ? payable - paid : 0n), verifiedByUserId: actorId, verifiedAt: new Date() } });
    if (['FULLY_PAID', 'OVERPAID'].includes(state.status)) {
      await tx.application.update({
        where: { id: row.applicationId },
        data: { paymentVerifiedById: actorId, paymentVerifiedAt: new Date() },
      });
      await tx.paymentWorkflowTask.upsert({ where: { id: `prepare-emgs-${row.applicationId}` }, create: { id: `prepare-emgs-${row.applicationId}`, tenantId, applicationId: row.applicationId, taskType: 'PREPARE_EMGS_APPLICATION', title: 'Prepare/Submit EMGS Application', createdById: actorId }, update: { status: 'PENDING', completedAt: null, completedById: null } });
    }
    await audit(tx, { tenantId, actorId, entityType: 'EMGS_TRANSACTION', entityId: id, action: 'PAYMENT_VERIFIED', newValue: { verifiedAmount, currency: row.currency, receiptNo, ledgerStatus: state.status } });
    return receipt;
  }, { isolationLevel: 'Serializable' });
}

async function reject(id, tenantId, actorId, data = {}) {
  const reason = String(data.reason || '').trim(); if (!reason) throw { statusCode: 400, message: 'Rejection reason is required' };
  return prisma.$transaction(async (tx) => {
    const row = await tx.emgsPaymentTransaction.findFirst({ where: { id, tenantId } });
    if (!row) throw { statusCode: 404, message: 'Payment transaction not found' };
    if (!['PROOF_UPLOADED', 'UNDER_VERIFICATION'].includes(row.status)) throw { statusCode: 409, message: 'This payment cannot be rejected' };
    const updated = await tx.emgsPaymentTransaction.update({ where: { id }, data: { status: 'REJECTED', rejectedByUserId: actorId, rejectedAt: new Date(), rejectionReason: reason } });
    await tx.applicationPaymentAccount.update({ where: { applicationId: row.applicationId }, data: { status: 'REJECTED' } });
    await tx.application.update({ where: { id: row.applicationId }, data: { emgsPaymentStatus: 'REJECTED' } });
    await audit(tx, { tenantId, actorId, entityType: 'EMGS_TRANSACTION', entityId: id, action: data.requestNewProof ? 'NEW_PROOF_REQUESTED' : 'PAYMENT_REJECTED', reason }); return updated;
  });
}

async function reverse(id, tenantId, actorId, data = {}) {
  const reason = String(data.reason || '').trim(); if (!reason) throw { statusCode: 400, message: 'Reversal reason is required' };
  return prisma.$transaction(async (tx) => {
    const row = await tx.emgsPaymentTransaction.findFirst({ where: { id, tenantId, status: 'VERIFIED' } });
    if (!row) throw { statusCode: 404, message: 'Verified payment transaction not found' };
    const existing = await tx.emgsPaymentReversal.findFirst({ where: { tenantId, transactionId: id, status: 'COMPLETED' } }); if (existing) return existing;
    const reversal = await tx.emgsPaymentReversal.create({ data: { tenantId, applicationId: row.applicationId, transactionId: id, amount: row.amount, currency: row.currency, reason, createdByUserId: actorId } });
    await tx.emgsPaymentTransaction.update({ where: { id }, data: { status: 'REFUNDED' } }); await recalculate(tx, row.applicationId, tenantId);
    await audit(tx, { tenantId, actorId, entityType: 'EMGS_REVERSAL', entityId: reversal.id, action: 'REFUND_REVERSAL_CREATED', newValue: { transactionId: id, amount: String(row.amount), currency: row.currency }, reason }); return reversal;
  }, { isolationLevel: 'Serializable' });
}

module.exports = { listAccounts, createAccount, updateAccount, archiveAccount, revealAccount, postpone, markNotRequired, setup, amendFee, summary, submitProof, startReview, verify, reject, reverse, recalculate, money, cents, decimalFromCents, maskAccountNumber, protectAccountNumber, revealAccountNumber, publicAccount, snapshot };
