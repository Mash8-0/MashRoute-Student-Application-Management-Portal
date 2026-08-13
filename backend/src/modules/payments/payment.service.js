const prisma = require('../../config/database');
const { getPagination, getPaginationMeta } = require('../../utils/pagination');
const { generateInvoiceNo } = require('../../utils/generateReference');

class PaymentService {
  async createPayment(tenantId, data) {
    const { studentId, applicationId, amount, currency, dueDate, description, notes } = data;

    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
    const invoiceNo = generateInvoiceNo(tenant?.slug || 'SL');

    return prisma.payment.create({
      data: {
        tenantId,
        studentId,
        applicationId: applicationId || null,
        invoiceNo,
        amount,
        currency: currency || 'USD',
        status: 'PENDING',
        dueDate: dueDate ? new Date(dueDate) : null,
        description,
        notes,
      },
      include: {
        student: { select: { fullName: true, passportNumber: true } },
        application: { select: { referenceNo: true } },
      },
    });
  }

  async listPayments(tenantId, query) {
    const { page, limit, skip } = getPagination(query);
    const { status, studentId, applicationId, search } = query;

    const where = {
      ...(tenantId && { tenantId }),
      ...(status && { status }),
      ...(studentId && { studentId }),
      ...(applicationId && { applicationId }),
      ...(search && {
        OR: [
          { invoiceNo: { contains: search, mode: 'insensitive' } },
          { student: { fullName: { contains: search, mode: 'insensitive' } } },
        ],
      }),
    };

    const [payments, total] = await Promise.all([
      prisma.payment.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          student: { select: { fullName: true } },
          application: { select: { referenceNo: true } },
        },
      }),
      prisma.payment.count({ where }),
    ]);

    return { payments, pagination: getPaginationMeta(total, page, limit) };
  }

  async getPayment(id, tenantId) {
    const payment = await prisma.payment.findFirst({
      where: { id, ...(tenantId && { tenantId }) },
      include: {
        student: { select: { fullName: true, email: true, phone: true } },
        application: { select: { referenceNo: true, status: true } },
      },
    });
    if (!payment) throw { statusCode: 404, message: 'Payment not found' };
    return payment;
  }

  async markAsPaid(id, tenantId, receiptUrl) {
    await this.getPayment(id, tenantId);
    return prisma.payment.update({
      where: { id },
      data: {
        status: 'PAID',
        paidAt: new Date(),
        receiptUrl,
      },
    });
  }

  async updatePayment(id, tenantId, data) {
    await this.getPayment(id, tenantId);
    return prisma.payment.update({
      where: { id },
      data: {
        amount: data.amount,
        currency: data.currency,
        status: data.status,
        dueDate: data.dueDate ? new Date(data.dueDate) : undefined,
        notes: data.notes,
        description: data.description,
      },
    });
  }

  async deletePayment(id, tenantId) {
    await this.getPayment(id, tenantId);
    return prisma.payment.delete({ where: { id } });
  }

  async getPaymentStats(tenantId) {
    const t = tenantId ? { tenantId } : {};
    const [total, paid, pending, overdue, revenue] = await Promise.all([
      prisma.payment.count({ where: { ...t } }),
      prisma.payment.count({ where: { ...t, status: 'PAID' } }),
      prisma.payment.count({ where: { ...t, status: 'PENDING' } }),
      prisma.payment.count({ where: { ...t, status: 'OVERDUE' } }),
      prisma.payment.aggregate({
        where: { ...t, status: 'PAID' },
        _sum: { amount: true },
      }),
    ]);
    return { total, paid, pending, overdue, totalRevenue: revenue._sum.amount || 0 };
  }
}

module.exports = new PaymentService();
