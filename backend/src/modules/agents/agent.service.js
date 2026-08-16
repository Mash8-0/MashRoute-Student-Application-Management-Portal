const prisma = require('../../config/database');
const { getPagination, getPaginationMeta } = require('../../utils/pagination');

const TYPES = ['REGISTERED_AGENT', 'MANAGED_AGENT', 'REFERRAL_PARTNER'];
const STATUSES = ['ACTIVE', 'INACTIVE', 'ARCHIVED'];

function clean(data) {
  const text = (v) => typeof v === 'string' ? (v.trim() || null) : null;
  return {
    type: data.type,
    displayName: text(data.displayName),
    agencyName: text(data.agencyName), contactPerson: text(data.contactPerson),
    email: text(data.email)?.toLowerCase() || null, phone: text(data.phone), whatsapp: text(data.whatsapp),
    address: text(data.address), notes: text(data.notes),
    linkedUserId: text(data.linkedUserId), assignedInternalStaffId: text(data.assignedInternalStaffId),
  };
}

async function validateRelations(tenantId, data, excludeId) {
  if (!TYPES.includes(data.type)) throw { statusCode: 400, message: 'Invalid agent type' };
  if (!data.displayName) throw { statusCode: 400, message: 'Agent name is required' };
  if (data.type !== 'REGISTERED_AGENT' && data.linkedUserId) {
    throw { statusCode: 400, message: 'Only a Registered Agent can have a login' };
  }
  if (data.linkedUserId) {
    const user = await prisma.user.findFirst({ where: { id: data.linkedUserId, tenantId, role: 'REGISTERED_AGENT', isActive: true, deletedAt: null } });
    if (!user) throw { statusCode: 400, message: 'Linked user must be an active Registered Agent user in this tenant' };
    const linked = await prisma.agent.findFirst({ where: { linkedUserId: data.linkedUserId, status: { not: 'ARCHIVED' }, ...(excludeId && { id: { not: excludeId } }) } });
    if (linked) throw { statusCode: 409, message: 'This login is already linked to an agent' };
  }
  if (data.assignedInternalStaffId) {
    const staff = await prisma.user.findFirst({ where: { id: data.assignedInternalStaffId, tenantId, role: { in: ['STAFF', 'TENANT_ADMIN'] }, isActive: true, deletedAt: null } });
    if (!staff) throw { statusCode: 400, message: 'Assigned staff is invalid' };
  }
}

class AgentService {
  async list(tenantId, query) {
    const { page, limit, skip } = getPagination(query);
    const where = { tenantId, ...(query.type && { type: query.type }), ...(query.status && { status: query.status }),
      ...(query.assignedInternalStaffId && { assignedInternalStaffId: query.assignedInternalStaffId }),
      ...(query.search && { OR: ['displayName','agencyName','contactPerson','email','phone','whatsapp'].map((key) => ({ [key]: { contains: query.search, mode: 'insensitive' } })) }) };
    const [rows, total] = await Promise.all([
      prisma.agent.findMany({ where, skip, take: Math.min(limit, 50), orderBy: { displayName: 'asc' }, include: { assignedInternalStaff: { select: { id: true, firstName: true, lastName: true } }, linkedUser: { select: { id: true, email: true } }, _count: { select: { students: true, commissions: true } } } }),
      prisma.agent.count({ where }),
    ]);
    return { rows, pagination: getPaginationMeta(total, page, Math.min(limit, 50)) };
  }
  async get(id, tenantId) {
    const row = await prisma.agent.findFirst({ where: { id, tenantId }, include: { assignedInternalStaff: { select: { id: true, firstName: true, lastName: true } }, linkedUser: { select: { id: true, email: true } }, _count: { select: { students: true, commissions: true } } } });
    if (!row) throw { statusCode: 404, message: 'Agent not found' }; return row;
  }
  async create(tenantId, userId, input) {
    const data = clean(input); await validateRelations(tenantId, data);
    return prisma.agent.create({ data: { ...data, tenantId, createdByUserId: userId } });
  }
  async update(id, tenantId, input) {
    const current = await this.get(id, tenantId); const data = { ...clean({ ...current, ...input }) };
    await validateRelations(tenantId, data, id);
    return prisma.agent.update({ where: { id }, data });
  }
  async status(id, tenantId, status) {
    if (!STATUSES.includes(status)) throw { statusCode: 400, message: 'Invalid agent status' };
    await this.get(id, tenantId);
    return prisma.agent.update({ where: { id }, data: { status, archivedAt: status === 'ARCHIVED' ? new Date() : null } });
  }
}
module.exports = new AgentService();
module.exports.TYPES = TYPES;
