const fs = require('fs');
const os = require('os');
const path = require('path');
const PDFDocument = require('pdfkit');

const money = (amount, currency = 'MYR') => {
  const prefix = currency === 'MYR' || currency === 'RM' ? 'RM' : currency;
  return `${prefix} ${Number(amount || 0).toLocaleString('en-MY', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
};

function formatDate(value) {
  if (!value) return '-';
  return new Date(value).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function tenantBankDetails(tenant) {
  const settings = tenant?.settings && typeof tenant.settings === 'object' ? tenant.settings : {};
  return settings.bankDetails || settings.bank || {};
}

function textOrDash(value) {
  return value ? String(value) : '-';
}

function drawLabelRows(doc, rows, x, y, labelWidth, valueWidth, rowHeight = 24) {
  rows.forEach(([label, value, options = {}], index) => {
    const rowY = y + index * rowHeight;
    const fontSize = options.fontSize || 11;
    doc.fillColor('#25283a').font('Helvetica').fontSize(fontSize).text(label, x, rowY, { width: labelWidth });
    doc.fillColor(options.color || '#1f2333').font(options.bold === false ? 'Helvetica' : 'Helvetica-Bold').fontSize(fontSize)
      .text(`: ${textOrDash(value)}`, x + labelWidth, rowY, { width: valueWidth, lineGap: 1 });
  });
}

async function generateInvoicePdf({ invoice, payment, application, tenant }) {
  const invoiceNo = invoice.invoiceNo || invoice.displayInvoiceNo || `DRAFT-${invoice.id || Date.now()}`;
  const tmpPath = path.join(os.tmpdir(), `${invoiceNo}.pdf`);
  const doc = new PDFDocument({ size: 'A4', margin: 0 });
  const stream = fs.createWriteStream(tmpPath);
  doc.pipe(stream);

  const student = application.student || payment.student || {};
  const university = application.university || {};
  tenantBankDetails(tenant);
  const items = Array.isArray(invoice.items) && invoice.items.length > 0
    ? invoice.items
    : [{ description: payment.description || invoice.invoiceType || 'Payment', quantity: 1, unitPrice: invoice.amount, amount: invoice.amount }];
  const currency = invoice.currency || payment.currency || 'MYR';
  const subtotal = Number(invoice.subtotal || items.reduce((sum, item) => sum + Number(item.amount || 0), 0));
  const sstRate = Number(invoice.sstRate || 0);
  const sstAmount = Number(invoice.sstAmount || subtotal * sstRate / 100);
  const grandTotal = Number(invoice.grandTotal || subtotal + sstAmount);
  const pageW = 595.28;
  const blue = '#0f8be8';
  const purple = '#7c2ff2';
  const text = '#202337';
  const muted = '#6b7280';
  const line = '#dbe3ee';

  doc.rect(0, 0, pageW, 841.89).fill('#ffffff');
  doc.save();
  doc.opacity(0.09).fillColor('#94a3b8');
  for (let i = -80; i < 760; i += 26) {
    doc.moveTo(i, 0).lineTo(i + 250, 842).strokeColor('#e5e7eb').lineWidth(0.7).stroke();
  }
  doc.restore();

  doc.fillColor(blue).font('Helvetica-Bold').fontSize(48).text('INVOICE', 35, 62, { width: 250 });
  doc.fillColor(text).font('Helvetica-Bold').fontSize(28)
    .text(textOrDash(invoice.tenantName || tenant.name), 315, 58, { width: 235, align: 'right' });
  doc.fillColor(text).font('Helvetica').fontSize(11)
    .text('MashRoute - Student Application Management Portal', 286, 100, { width: 264, align: 'right' });
  const tenantAddress = invoice.tenantAddress || tenant.address;
  const contactY = tenantAddress ? 146 : 126;
  if (tenantAddress) {
    doc.fillColor(text).fontSize(11).text(tenantAddress, 286, 124, { width: 264, align: 'right' });
  }
  doc.text([invoice.tenantEmail || tenant.email, invoice.tenantPhone || tenant.phone].filter(Boolean).join(' || '), 286, contactY, { width: 264, align: 'right' });

  drawLabelRows(doc, [
    ['Invoice No', invoiceNo],
    ['Reference', invoice.referenceNo || payment.transactionReference],
    ['Payment Date', formatDate(invoice.paymentDate || payment.paymentDate)],
    ['Issue Date', formatDate(invoice.issueDate)],
    ['Due Date:', formatDate(invoice.dueDate), { color: purple }],
  ], 35, 184, 93, 280, 25);

  let y = 298;
  doc.rect(35, y, 525, 168).fill('#ffffff');
  doc.roundedRect(45, y + 8, 505, 146, 8).strokeColor(line).lineWidth(1).stroke();
  doc.roundedRect(62, y + 26, 28, 28, 5).fill(blue);
  doc.roundedRect(70, y + 34, 12, 12, 4).fill('#ffffff');
  doc.fillColor(blue).font('Helvetica-Bold').fontSize(16).text('BILL TO', 106, y + 32);

  const billY = y + 76;
  drawLabelRows(doc, [
    ['Student Name', invoice.studentName || student.fullName, { fontSize: 9.5 }],
    ['Passport No', invoice.passportNo || student.passportNumber, { fontSize: 9.5 }],
    ['Email', invoice.studentEmail || student.email, { fontSize: 8.8 }],
    ['Phone', invoice.studentPhone || student.phone, { fontSize: 9.5 }],
  ], 62, billY, 72, 166, 21);

  doc.moveTo(276, billY - 8).lineTo(276, billY + 72).strokeColor('#edf2f7').lineWidth(1).stroke();
  drawLabelRows(doc, [
    ['University', invoice.universityName || university.name, { fontSize: 9.2 }],
    ['Programme', invoice.programmeName || application.program, { fontSize: 9.2 }],
    ['Intake', invoice.intake || application.intake, { fontSize: 9.5 }],
  ], 300, billY, 62, 176, 26);

  y = 482;
  const tableX = 45;
  const tableW = 505;
  const descW = 210;
  const qtyW = 74;
  const unitW = 112;
  const amountW = tableW - descW - qtyW - unitW;
  const rowH = 31;
  doc.roundedRect(tableX, y, tableW, 34, 6).fill(blue);
  doc.rect(tableX + descW, y, qtyW, 34).fill('#3d66f0');
  doc.rect(tableX + descW + qtyW, y, unitW, 34).fill('#0f8be8');
  doc.rect(tableX + descW + qtyW + unitW, y, amountW, 34).fill(purple);
  doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(11)
    .text('Description', tableX + 16, y + 12, { width: descW - 30 })
    .text('Qty', tableX + descW, y + 12, { width: qtyW, align: 'center' })
    .text('Unit Price', tableX + descW + qtyW, y + 12, { width: unitW, align: 'center' })
    .text('Amount', tableX + descW + qtyW + unitW, y + 12, { width: amountW - 16, align: 'right' });

  items.forEach((item, index) => {
    const rowY = y + 34 + index * rowH;
    const qty = Number(item.quantity || 1);
    const unit = Number(item.unitPrice || 0);
    const amount = Number(item.amount || qty * unit);
    doc.rect(tableX, rowY, tableW, rowH).fill('#ffffff');
    doc.moveTo(tableX, rowY).lineTo(tableX + tableW, rowY).strokeColor('#edf2f7').lineWidth(1).stroke();
    doc.moveTo(tableX + descW, rowY).lineTo(tableX + descW, rowY + rowH).strokeColor('#edf2f7').stroke();
    doc.moveTo(tableX + descW + qtyW, rowY).lineTo(tableX + descW + qtyW, rowY + rowH).strokeColor('#edf2f7').stroke();
    doc.moveTo(tableX + descW + qtyW + unitW, rowY).lineTo(tableX + descW + qtyW + unitW, rowY + rowH).strokeColor('#edf2f7').stroke();
    doc.fillColor(text).font('Helvetica').fontSize(8.8)
      .text(item.description, tableX + 16, rowY + 10, { width: descW - 30, lineGap: 1 })
      .text(String(qty), tableX + descW, rowY + 10, { width: qtyW, align: 'center' })
      .text(money(unit, currency), tableX + descW + qtyW, rowY + 10, { width: unitW, align: 'center' })
      .text(money(amount, currency), tableX + descW + qtyW + unitW, rowY + 10, { width: amountW - 16, align: 'right' });
  });
  doc.roundedRect(tableX, y, tableW, 34 + items.length * rowH, 6).strokeColor(line).lineWidth(1).stroke();

  y = 720;
  doc.roundedRect(45, y, 235, 86, 6).strokeColor(line).lineWidth(1).stroke();
  doc.roundedRect(62, y + 24, 24, 24, 5).fill('#f0e7ff');
  const account = invoice.paymentAccountSnapshot && typeof invoice.paymentAccountSnapshot === 'object' ? invoice.paymentAccountSnapshot : null;
  const accountText = account
    ? `${account.bankName || ''} · ${account.accountHolderName || ''}\nAccount: ${account.maskedAccountNumber || '-'}${account.swiftBic ? ` · SWIFT: ${account.swiftBic}` : ''}`
    : (invoice.notes || 'Please make payment before the due date and send payment proof through the MashRoute portal.');
  doc.fillColor(purple).font('Helvetica-Bold').fontSize(11).text(account ? 'PAYMENT ACCOUNT' : 'NOTES', 100, y + 22);
  doc.fillColor(text).font('Helvetica').fontSize(9)
    .text(accountText, 100, y + 38, { width: 150, lineGap: 1 });

  doc.roundedRect(305, y, 245, 86, 6).strokeColor(line).lineWidth(1).stroke();
  const sstLabel = Number(sstRate || 0).toFixed(2).replace(/\.00$/, '');
  doc.fillColor(text).font('Helvetica').fontSize(11)
    .text('Subtotal', 320, y + 14).text(money(subtotal, currency), 440, y + 14, { width: 90, align: 'right' });
  doc.text(`SST (${sstLabel}%)`, 320, y + 36).text(money(sstAmount, currency), 440, y + 36, { width: 90, align: 'right' });
  doc.moveTo(320, y + 58).lineTo(530, y + 58).dash(3, { space: 3 }).strokeColor(line).stroke().undash();
  doc.fillColor(purple).font('Helvetica-Bold').fontSize(13).text('GRAND TOTAL', 320, y + 68);
  doc.fillColor(blue).font('Helvetica-Bold').fontSize(18).text(money(grandTotal, currency), 410, y + 64, { width: 120, align: 'right' });

  const footer = invoice.footerNote || 'This is auto generated from the system || No signature Required\nAll copyright to MashRoute';
  doc.fillColor('#111827').font('Helvetica-Oblique').fontSize(11)
    .text(footer, 60, 814, { width: 475, align: 'center', lineGap: 8, characterSpacing: 2 });

  doc.end();

  await new Promise((resolve, reject) => {
    stream.on('finish', resolve);
    stream.on('error', reject);
  });

  return tmpPath;
}

module.exports = { generateInvoicePdf };
