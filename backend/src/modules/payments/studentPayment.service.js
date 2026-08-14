const crypto = require('crypto');
const fs = require('fs');
const prisma = require('../../config/database');
const { uploadToDrive } = require('../../services/driveUpload');
const emgs = require('./emgsPayment.service');

const INITIAL_CODES = new Set(['REGISTRATION_FEE', 'ADMINISTRATION_FEE', 'SECURITY_BOND', 'TUITION_FEE']);
const OTHER_CATEGORIES = new Set(['ACCOMMODATION', 'AIR_TICKET', 'AIRPORT_PICKUP', 'MEDICAL_INSURANCE', 'VISA_EVISA', 'CUSTOM_OTHER']);
const PAYMENT_METHODS = new Set(['BANK_TRANSFER', 'CASH', 'CARD', 'ONLINE_PAYMENT', 'MOBILE_BANKING', 'UNIVERSITY_DIRECT_PAYMENT', 'EMGS_DIRECT_PAYMENT', 'OTHER']);
const PAID_BY = new Set(['STUDENT', 'PARENT_SPONSOR', 'AGENT', 'STAFF', 'OTHER']);

function parseMoney(value, field = 'amount', allowZero = false) {
  const raw = String(value ?? '').trim();
  if (!/^\d{1,10}(?:\.\d{1,2})?$/.test(raw)) throw { statusCode: 400, message: `${field} must have at most 2 decimal places` };
  const [whole, fraction = ''] = raw.split('.');
  const minor = BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0'));
  if (minor < 0n || (!allowZero && minor === 0n)) throw { statusCode: 400, message: `${field} must be positive` };
  return minor;
}

function decimal(minor) {
  const negative = minor < 0n; const value = negative ? -minor : minor;
  return `${negative ? '-' : ''}${value / 100n}.${String(value % 100n).padStart(2, '0')}`;
}

function rateHundredths(value, required = false) {
  if ((value == null || value === '') && !required) return 0n;
  const minor = parseMoney(value, 'SST rate', true);
  if (minor > 10000n) throw { statusCode: 400, message: 'SST rate cannot exceed 100%' };
  return minor;
}

function roundDivide(numerator, denominator) {
  return (numerator + denominator / 2n) / denominator;
}

function calculateSst({ amount, treatment = 'NO_SST', rate }) {
  const entered = parseMoney(amount, 'base amount');
  const mode = String(treatment || 'NO_SST');
  const appliedRate = mode === 'NO_SST' ? 0n : rateHundredths(rate == null || rate === '' ? '6' : rate, mode === 'CUSTOM_SST_RATE');
  let preTax = entered; let tax = 0n; let final = entered;
  if (mode === 'SST_INCLUDED') {
    preTax = roundDivide(entered * 10000n, 10000n + appliedRate);
    tax = entered - preTax;
  } else if (mode === 'ADD_SST' || mode === 'CUSTOM_SST_RATE') {
    tax = roundDivide(entered * appliedRate, 10000n);
    final = entered + tax;
  } else if (mode !== 'NO_SST') throw { statusCode: 400, message: 'Invalid SST treatment' };
  return {
    baseAmount: decimal(entered), preTaxAmount: decimal(preTax), sstAmount: decimal(tax), finalAmount: decimal(final),
    sstRate: decimal(appliedRate), sstTreatment: mode,
    calculationSnapshot: { enteredAmount: decimal(entered), treatment: mode, rate: decimal(appliedRate), rounding: 'HALF_UP_MINOR_UNIT' },
  };
}

async function appForTenant(applicationId, tenantId) {
  const application = await prisma.application.findFirst({ where: { id: applicationId, tenantId, deletedAt: null }, include: { student: true, university: true } });
  if (!application) throw { statusCode: 404, message: 'Application not found' };
  return application;
}

async function eligibleAccount(id, tenantId, application, currency) {
  const account = await prisma.paymentDestinationAccount.findFirst({ where: { id, tenantId, currency, isActive: true, archivedAt: null } });
  if (!account) throw { statusCode: 400, message: 'Selected payment account is inactive, unavailable, or has a currency mismatch' };
  if (account.accountType === 'UNIVERSITY_ACCOUNT' && account.universityId !== application.universityId) throw { statusCode: 400, message: 'Selected University Account does not belong to this Application University' };
  return account;
}

function publicSection(section) {
  if (!section) return section;
  const sanitize = (snapshot) => { if (!snapshot) return snapshot; const { protectedAccountNumber, ...safe } = snapshot; return safe; };
  return { ...section, destinationSnapshot: sanitize(section.destinationSnapshot), transactions: section.transactions?.map((tx) => ({ ...tx, destinationSnapshot: sanitize(tx.destinationSnapshot) })) };
}

async function audit(tx, data) {
  return tx.financialAuditLog.create({ data });
}

async function configure(applicationId, tenantId, actorId, data) {
  const application = await appForTenant(applicationId, tenantId);
  const sectionType = String(data.sectionType || '');
  if (!['INITIAL_UNIVERSITY', 'OTHER'].includes(sectionType)) throw { statusCode: 400, message: 'Invalid payment section type' };
  if (sectionType === 'OTHER' && !OTHER_CATEGORIES.has(String(data.category || ''))) throw { statusCode: 400, message: 'Invalid Other Payment category' };
  const currency = String(data.currency || 'MYR').toUpperCase();
  if (!/^[A-Z]{3}$/.test(currency)) throw { statusCode: 400, message: 'A valid currency is required' };
  const dueDate = new Date(data.dueDate); if (Number.isNaN(dueDate.getTime())) throw { statusCode: 400, message: 'A valid due date is required' };
  const account = await eligibleAccount(data.destinationAccountId, tenantId, application, currency);
  const sourceLines = Array.isArray(data.lines) ? data.lines.filter((line) => line.enabled !== false) : [];
  if (!sourceLines.length) throw { statusCode: 400, message: 'At least one fee line is required' };
  if (sectionType === 'INITIAL_UNIVERSITY') {
    for (const line of sourceLines) if (!INITIAL_CODES.has(line.feeCode)) throw { statusCode: 400, message: 'Invalid Initial/University fee line' };
  }
  const lines = sourceLines.map((line, index) => {
    const treatment = line.feeCode === 'SECURITY_BOND' && !line.sstTreatment ? 'NO_SST' : line.sstTreatment;
    return { ...calculateSst({ amount: line.amount, treatment, rate: line.sstRate }), feeCode: line.feeCode || `OTHER_${index + 1}`, description: String(line.description || line.feeCode || 'Fee'), notes: line.notes || null, sortOrder: index };
  });
  const snapshot = emgs.snapshot(account, application.university?.name);
  const activeSectionKey = sectionType === 'INITIAL_UNIVERSITY' ? `${applicationId}:INITIAL_UNIVERSITY` : null;
  return prisma.$transaction(async (tx) => {
    let section = activeSectionKey ? await tx.paymentFeeSection.findUnique({ where: { activeSectionKey } }) : null;
    if (section) {
      const verified = await tx.paymentSectionTransaction.count({ where: { sectionId: section.id, status: 'VERIFIED' } });
      if (verified) throw { statusCode: 409, message: 'A section with verified payments cannot be silently edited; create a revision' };
      const oldValue = publicSection(section);
      await tx.paymentFeeLine.deleteMany({ where: { sectionId: section.id } });
      section = await tx.paymentFeeSection.update({ where: { id: section.id }, data: { category: data.category || null, customLabel: data.customLabel || null, description: data.description || null, currency, dueDate, destinationType: account.accountType, destinationAccountId: account.id, destinationSnapshot: snapshot, allowPartialPayment: !!data.allowPartialPayment, minimumPartialAmount: data.minimumPartialAmount ? decimal(parseMoney(data.minimumPartialAmount, 'minimum partial amount')) : null, studentNote: data.studentNote || null, internalNote: data.internalNote || null, updatedByUserId: actorId, lines: { create: lines.map((line) => ({ ...line, tenantId })) } }, include: { lines: true } });
      await audit(tx, { tenantId, actorId, entityType: 'PAYMENT_SECTION', entityId: section.id, action: 'FEE_CHANGED', oldValue, newValue: publicSection(section) });
      return publicSection(section);
    }
    section = await tx.paymentFeeSection.create({ data: { tenantId, studentId: application.studentId, applicationId, sectionType, category: data.category || null, customLabel: data.customLabel || null, description: data.description || null, currency, dueDate, destinationType: account.accountType, destinationAccountId: account.id, destinationSnapshot: snapshot, allowPartialPayment: !!data.allowPartialPayment, minimumPartialAmount: data.minimumPartialAmount ? decimal(parseMoney(data.minimumPartialAmount, 'minimum partial amount')) : null, studentNote: data.studentNote || null, internalNote: data.internalNote || null, activeSectionKey, createdByUserId: actorId, updatedByUserId: actorId, lines: { create: lines.map((line) => ({ ...line, tenantId })) } }, include: { lines: true } });
    await audit(tx, { tenantId, actorId, entityType: 'PAYMENT_SECTION', entityId: section.id, action: 'PAYMENT_CONFIGURED', newValue: publicSection(section) });
    return publicSection(section);
  }, { isolationLevel: 'Serializable' });
}

async function recalculate(tx, sectionId, tenantId) {
  const lines = await tx.paymentFeeLine.findMany({ where: { sectionId, tenantId } });
  const transactions = await tx.paymentSectionTransaction.findMany({ where: { sectionId, tenantId } });
  const allocations = await tx.paymentSectionAllocation.findMany({ where: { tenantId, feeLineId: { in: lines.map((line) => line.id) } } });
  const payable = lines.reduce((sum, line) => sum + parseMoney(line.finalAmount, 'amount', true), 0n);
  const verified = allocations.reduce((sum, allocation) => sum + parseMoney(allocation.amount, 'amount', true), 0n);
  const pending = transactions.filter((row) => ['PROOF_UPLOADED', 'UNDER_REVIEW'].includes(row.status)).reduce((sum, row) => sum + parseMoney(row.amount, 'amount', true), 0n);
  let status = verified > payable ? 'OVERPAID' : verified === payable && payable > 0n ? 'FULLY_PAID' : verified > 0n ? 'PARTIALLY_PAID' : transactions.some((row) => row.status === 'UNDER_REVIEW') ? 'UNDER_VERIFICATION' : pending > 0n ? 'PROOF_UPLOADED' : 'PAYMENT_PENDING';
  await tx.paymentFeeSection.update({ where: { id: sectionId }, data: { status } });
  return { status, totalPayable: decimal(payable), verifiedPaid: decimal(verified), pendingVerification: decimal(pending), outstanding: decimal(payable > verified ? payable - verified : 0n), credit: decimal(verified > payable ? verified - payable : 0n) };
}

async function summary(applicationId, tenantId) {
  await appForTenant(applicationId, tenantId);
  const sections = await prisma.paymentFeeSection.findMany({ where: { tenantId, applicationId, status: { not: 'CANCELLED' } }, orderBy: { createdAt: 'asc' }, include: { lines: { orderBy: { sortOrder: 'asc' }, include: { allocations: true } }, transactions: { orderBy: { createdAt: 'desc' }, include: { allocations: true, receipt: true } } } });
  const result = [];
  for (const section of sections) result.push(publicSection({ ...section, totals: await recalculate(prisma, section.id, tenantId) }));
  return result;
}

async function submitProof(sectionId, tenantId, actorId, data, file) {
  if (!file) throw { statusCode: 400, message: 'Payment proof document is required' };
  const section = await prisma.paymentFeeSection.findFirst({ where: { id: sectionId, tenantId, status: { notIn: ['CANCELLED', 'NOT_REQUIRED', 'FULLY_PAID'] } } });
  if (!section) throw { statusCode: 404, message: 'Active payment section not found' };
  const amount = decimal(parseMoney(data.amount));
  if (String(data.currency || '').toUpperCase() !== section.currency) throw { statusCode: 400, message: 'Payment currency must match the section currency' };
  if (!PAYMENT_METHODS.has(data.paymentMethod)) throw { statusCode: 400, message: 'Invalid payment method' };
  if (!PAID_BY.has(data.paidBy)) throw { statusCode: 400, message: 'Invalid payer type' };
  const proofHash = crypto.createHash('sha256').update(fs.readFileSync(file.path)).digest('hex');
  const duplicate = await prisma.paymentSectionTransaction.findFirst({ where: { tenantId, OR: [{ proofHash }, ...(data.transactionReference ? [{ transactionReference: String(data.transactionReference).trim() }] : [])], status: { notIn: ['REJECTED', 'REVERSED', 'REFUNDED'] } } });
  if (duplicate) throw { statusCode: 409, message: 'This proof or transaction reference has already been submitted' };
  const uploaded = await uploadToDrive(file, 'payment-proof');
  return prisma.$transaction(async (tx) => {
    const row = await tx.paymentSectionTransaction.create({ data: { tenantId, studentId: section.studentId, applicationId: section.applicationId, sectionId, amount, currency: section.currency, paymentDate: new Date(data.paymentDate), paymentMethod: data.paymentMethod, paidBy: data.paidBy, destinationType: section.destinationType, destinationAccountId: section.destinationAccountId, destinationSnapshot: section.destinationSnapshot, transactionReference: data.transactionReference || null, note: data.note || null, proofFileUrl: uploaded.fileUrl, proofHash, submittedByUserId: actorId } });
    await recalculate(tx, sectionId, tenantId);
    await audit(tx, { tenantId, actorId, entityType: 'PAYMENT_TRANSACTION', entityId: row.id, action: 'PROOF_UPLOADED', newValue: { amount, currency: section.currency, reference: row.transactionReference, proofHash } });
    return row;
  });
}

async function startReview(id, tenantId, actorId) {
  return prisma.$transaction(async (tx) => {
    const row = await tx.paymentSectionTransaction.findFirst({ where: { id, tenantId } });
    if (!row) throw { statusCode: 404, message: 'Payment transaction not found' };
    if (row.status !== 'PROOF_UPLOADED') throw { statusCode: 409, message: 'Only uploaded proofs can enter review' };
    const updated = await tx.paymentSectionTransaction.update({ where: { id }, data: { status: 'UNDER_REVIEW' } });
    await recalculate(tx, row.sectionId, tenantId);
    await audit(tx, { tenantId, actorId, entityType: 'PAYMENT_TRANSACTION', entityId: id, action: 'VERIFICATION_STARTED' });
    return updated;
  });
}

async function nextNumber(tx, tenantId, documentType, prefix) {
  const year = new Date().getUTCFullYear();
  const sequence = await tx.financialDocumentSequence.upsert({ where: { tenantId_documentType_year: { tenantId, documentType, year } }, create: { tenantId, documentType, year, lastSequence: 1 }, update: { lastSequence: { increment: 1 } } });
  return `${prefix}-${year}-${String(sequence.lastSequence).padStart(6, '0')}`;
}

async function verify(id, tenantId, actorId, data) {
  return prisma.$transaction(async (tx) => {
    const row = await tx.paymentSectionTransaction.findFirst({ where: { id, tenantId }, include: { section: { include: { lines: true } } } });
    if (!row) throw { statusCode: 404, message: 'Payment transaction not found' };
    if (!['PROOF_UPLOADED', 'UNDER_REVIEW'].includes(row.status)) throw { statusCode: 409, message: 'This transaction cannot be verified' };
    const allocations = Array.isArray(data.allocations) ? data.allocations : [];
    if (!allocations.length) throw { statusCode: 400, message: 'At least one reviewed fee allocation is required' };
    const lineIds = new Set(row.section.lines.map((line) => line.id));
    let allocated = 0n;
    for (const allocation of allocations) { if (!lineIds.has(allocation.feeLineId)) throw { statusCode: 400, message: 'Allocation fee line does not belong to this payment section' }; allocated += parseMoney(allocation.amount, 'allocation amount'); }
    if (allocated > parseMoney(row.amount)) throw { statusCode: 400, message: 'Allocated amount cannot exceed the submitted amount' };
    for (const allocation of allocations) await tx.paymentSectionAllocation.create({ data: { tenantId, transactionId: id, feeLineId: allocation.feeLineId, amount: decimal(parseMoney(allocation.amount, 'allocation amount')) } });
    await tx.paymentSectionTransaction.update({ where: { id }, data: { amount: decimal(allocated), status: 'VERIFIED', verifiedByUserId: actorId, verifiedAt: new Date() } });
    const totals = await recalculate(tx, row.sectionId, tenantId);
    const receiptNo = await nextNumber(tx, tenantId, 'RECEIPT', 'RCT');
    const receipt = await tx.paymentSectionReceipt.create({ data: { tenantId, studentId: row.studentId, applicationId: row.applicationId, sectionId: row.sectionId, transactionId: id, receiptNo, amount: decimal(allocated), currency: row.currency, destinationType: row.destinationType, destinationSnapshot: row.destinationSnapshot, remainingBalance: totals.outstanding, verifiedByUserId: actorId, verifiedAt: new Date() } });
    if (parseMoney(totals.credit, 'credit', true) > 0n) await tx.studentPaymentCredit.upsert({ where: { transactionId: id }, create: { tenantId, studentId: row.studentId, applicationId: row.applicationId, sectionId: row.sectionId, transactionId: id, amount: totals.credit, currency: row.currency }, update: { amount: totals.credit, status: 'AVAILABLE' } });
    await audit(tx, { tenantId, actorId, entityType: 'PAYMENT_TRANSACTION', entityId: id, action: 'PAYMENT_VERIFIED', newValue: { amount: decimal(allocated), currency: row.currency, receiptNo, sectionStatus: totals.status } });
    return { receipt, totals };
  }, { isolationLevel: 'Serializable' });
}

async function reject(id, tenantId, actorId, data = {}) {
  const reason = String(data.reason || '').trim(); if (!reason) throw { statusCode: 400, message: 'Rejection reason is required' };
  return prisma.$transaction(async (tx) => {
    const row = await tx.paymentSectionTransaction.findFirst({ where: { id, tenantId } });
    if (!row) throw { statusCode: 404, message: 'Payment transaction not found' };
    if (!['PROOF_UPLOADED', 'UNDER_REVIEW'].includes(row.status)) throw { statusCode: 409, message: 'This transaction cannot be rejected' };
    const updated = await tx.paymentSectionTransaction.update({ where: { id }, data: { status: 'REJECTED', rejectedByUserId: actorId, rejectedAt: new Date(), rejectionReason: reason } });
    await recalculate(tx, row.sectionId, tenantId);
    await audit(tx, { tenantId, actorId, entityType: 'PAYMENT_TRANSACTION', entityId: id, action: data.requestNewProof ? 'NEW_PROOF_REQUESTED' : 'PAYMENT_REJECTED', reason });
    return updated;
  });
}

async function cancelReview(id, tenantId, actorId) {
  return prisma.$transaction(async (tx) => {
    const row = await tx.paymentSectionTransaction.findFirst({ where: { id, tenantId } });
    if (!row) throw { statusCode: 404, message: 'Payment transaction not found' };
    if (row.status !== 'UNDER_REVIEW') throw { statusCode: 409, message: 'Only a transaction under review can be returned' };
    const updated = await tx.paymentSectionTransaction.update({ where: { id }, data: { status: 'PROOF_UPLOADED' } });
    await recalculate(tx, row.sectionId, tenantId);
    await audit(tx, { tenantId, actorId, entityType: 'PAYMENT_TRANSACTION', entityId: id, action: 'REVIEW_CANCELLED' });
    return updated;
  });
}

module.exports = { calculateSst, parseMoney, decimal, configure, summary, submitProof, startReview, verify, reject, cancelReview, publicSection, INITIAL_CODES, OTHER_CATEGORIES };
