const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const prisma = require('../../config/database');
const { generateTokenPair, verifyRefreshToken } = require('../../utils/tokenUtils');

class AuthService {
  async login(email, password) {
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase(), deletedAt: null },
      include: {
        tenant: {
          select: {
            id: true,
            name: true,
            slug: true,
            status: true,
            plan: true,
            logo: true,
            rejectionReason: true,
          },
        },
      },
    });

    if (!user) throw { statusCode: 401, message: 'Invalid credentials' };

    // Always verify the password first so account-status messaging never leaks
    // whether a given email exists with a different state.
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) throw { statusCode: 401, message: 'Invalid credentials' };

    const tenantStatus = user.tenant?.status;

    // Suspended companies are hard-blocked at login.
    if (tenantStatus === 'SUSPENDED') {
      throw { statusCode: 403, message: 'Your company account has been suspended' };
    }

    // PENDING / REJECTED company users are allowed to authenticate so the client
    // can route them to a dedicated pending / rejected screen. They remain unable
    // to reach real tenant data: their `isActive` flag is false, and the auth
    // middleware blocks inactive users from every protected API route.
    // For everyone else (active companies + super admins) enforce the per-user
    // active flag as usual.
    const isGatedStatus = tenantStatus === 'PENDING' || tenantStatus === 'REJECTED';
    if (!isGatedStatus && !user.isActive) {
      throw { statusCode: 401, message: 'Account is deactivated' };
    }

    const { accessToken, refreshToken } = generateTokenPair(user);

    await prisma.user.update({
      where: { id: user.id },
      data: { refreshToken, lastLoginAt: new Date() },
    });

    const { password: _, refreshToken: __, resetToken: ___, ...safeUser } = user;
    return { user: safeUser, accessToken, refreshToken };
  }

  async refreshTokens(token) {
    let decoded;
    try {
      decoded = verifyRefreshToken(token);
    } catch {
      throw { statusCode: 401, message: 'Invalid or expired refresh token' };
    }

    const user = await prisma.user.findFirst({
      where: { id: decoded.id, refreshToken: token, deletedAt: null },
    });

    if (!user) throw { statusCode: 401, message: 'Refresh token revoked' };

    const { accessToken, refreshToken: newRefreshToken } = generateTokenPair(user);
    await prisma.user.update({ where: { id: user.id }, data: { refreshToken: newRefreshToken } });

    return { accessToken, refreshToken: newRefreshToken };
  }

  async logout(userId) {
    await prisma.user.update({
      where: { id: userId },
      data: { refreshToken: null },
    });
  }

  async forgotPassword(email) {
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase(), deletedAt: null },
    });

    // Always return success to prevent email enumeration
    if (!user) return { message: 'If this email exists, a reset link has been sent' };

    const resetToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(resetToken).digest('hex');

    await prisma.user.update({
      where: { id: user.id },
      data: {
        resetToken: hashedToken,
        resetTokenExpiry: new Date(Date.now() + 60 * 60 * 1000), // 1 hour
      },
    });

    return { resetToken, user };
  }

  async resetPassword(token, newPassword) {
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    const user = await prisma.user.findFirst({
      where: {
        resetToken: hashedToken,
        resetTokenExpiry: { gt: new Date() },
        deletedAt: null,
      },
    });

    if (!user) throw { statusCode: 400, message: 'Invalid or expired reset token' };

    const hashedPassword = await bcrypt.hash(newPassword, 12);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        resetToken: null,
        resetTokenExpiry: null,
        refreshToken: null,
      },
    });
  }

  async changePassword(userId, currentPassword, newPassword) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) throw { statusCode: 400, message: 'Current password is incorrect' };

    const hashedPassword = await bcrypt.hash(newPassword, 12);
    await prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword, refreshToken: null },
    });
  }

  async getProfile(userId) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        avatar: true,
        role: true,
        agentCategory: true,
        tenantId: true,
        isEmailVerified: true,
        lastLoginAt: true,
        createdAt: true,
        tenant: {
          select: { id: true, name: true, slug: true, status: true, plan: true, logo: true },
        },
      },
    });
    if (!user) throw { statusCode: 404, message: 'User not found' };
    return user;
  }

  async updateProfile(userId, data) {
    const { firstName, lastName, phone, avatar } = data;
    return prisma.user.update({
      where: { id: userId },
      data: { firstName, lastName, phone, avatar },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        avatar: true,
        role: true,
        tenantId: true,
      },
    });
  }
}

module.exports = new AuthService();
