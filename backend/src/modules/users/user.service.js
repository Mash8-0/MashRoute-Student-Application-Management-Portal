const bcrypt = require('bcryptjs');
const prisma = require('../../config/database');
const { getPagination, getPaginationMeta } = require('../../utils/pagination');

class UserService {
  async createUser(tenantId, data, creatorRole) {
    const { email, password, firstName, lastName, phone, role, agentCategory } = data;
    const { isValidCategory } = require('../../utils/agentCategories');

    // TENANT_ADMIN cannot create SUPER_ADMIN
    if (creatorRole !== 'SUPER_ADMIN' && role === 'SUPER_ADMIN') {
      throw { statusCode: 403, message: 'Cannot assign SUPER_ADMIN role' };
    }

    // Check tenant user limit
    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
    const userCount = await prisma.user.count({ where: { tenantId, deletedAt: null } });
    if (userCount >= (tenant?.maxUsers || 10)) {
      throw { statusCode: 400, message: 'User limit reached for this plan' };
    }

    const hashedPassword = await bcrypt.hash(password || 'Staff@123!', 12);

    return prisma.user.create({
      data: {
        tenantId,
        email: email.toLowerCase(),
        password: hashedPassword,
        firstName,
        lastName,
        phone,
        role: role || 'STAFF',
        agentCategory: isValidCategory(agentCategory) ? agentCategory : 'STANDARD',
        isEmailVerified: true,
        isActive: true,
      },
      select: {
        id: true, email: true, firstName: true, lastName: true,
        phone: true, role: true, agentCategory: true, isActive: true, createdAt: true,
      },
    });
  }

  async listUsers(tenantId, query) {
    const { page, limit, skip } = getPagination(query);
    const { search, role, isActive } = query;

    const where = {
      tenantId,
      deletedAt: null,
      ...(role && { role }),
      ...(isActive !== undefined && { isActive: isActive === 'true' }),
      ...(search && {
        OR: [
          { firstName: { contains: search, mode: 'insensitive' } },
          { lastName: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } },
        ],
      }),
    };

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true, email: true, firstName: true, lastName: true,
          phone: true, role: true, agentCategory: true, isActive: true, avatar: true,
          lastLoginAt: true, createdAt: true,
          _count: { select: { assignedApplications: true } },
        },
      }),
      prisma.user.count({ where }),
    ]);

    return { users, pagination: getPaginationMeta(total, page, limit) };
  }

  async getUser(id, tenantId) {
    const where = { id };
    if (tenantId) where.tenantId = tenantId;

    const user = await prisma.user.findFirst({
      where,
      select: {
        id: true, email: true, firstName: true, lastName: true,
        phone: true, role: true, agentCategory: true, isActive: true, avatar: true,
        lastLoginAt: true, createdAt: true, tenantId: true,
        _count: { select: { assignedApplications: true } },
      },
    });
    if (!user) throw { statusCode: 404, message: 'User not found' };
    return user;
  }

  async updateUser(id, tenantId, data) {
    const { firstName, lastName, phone, role, isActive, avatar, agentCategory } = data;
    const { isValidCategory } = require('../../utils/agentCategories');
    return prisma.user.update({
      where: { id },
      data: {
        firstName, lastName, phone, role, isActive, avatar,
        ...(agentCategory !== undefined && isValidCategory(agentCategory) && { agentCategory }),
      },
      select: {
        id: true, email: true, firstName: true, lastName: true,
        phone: true, role: true, agentCategory: true, isActive: true, avatar: true,
      },
    });
  }

  async resetUserPassword(id, newPassword) {
    const hashed = await bcrypt.hash(newPassword, 12);
    return prisma.user.update({
      where: { id },
      data: { password: hashed, refreshToken: null },
    });
  }

  async deleteUser(id) {
    return prisma.user.update({
      where: { id },
      data: { deletedAt: new Date(), isActive: false, refreshToken: null },
    });
  }
}

module.exports = new UserService();
