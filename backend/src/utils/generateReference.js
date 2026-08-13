const generateReferenceNo = (prefix = 'MR') => {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `${prefix}-${timestamp}-${random}`;
};

const generateInvoiceNo = (tenantSlug = 'SL') => {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const random = Math.random().toString(36).substring(2, 7).toUpperCase();
  return `INV-${tenantSlug.toUpperCase()}-${year}${month}-${random}`;
};

module.exports = { generateReferenceNo, generateInvoiceNo };
