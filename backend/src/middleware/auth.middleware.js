const { verifyAccessToken } = require('../utils/tokenUtils');
const ApiResponse = require('../utils/apiResponse');
const prisma = require('../config/database');

const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return ApiResponse.unauthorized(res, 'No token provided');
    }

    const token = authHeader.split(' ')[1];
    const decoded = verifyAccessToken(token);

    const user = await prisma.user.findUnique({
      where: { id: decoded.id, deletedAt: null },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        tenantId: true,
        isActive: true,
        avatar: true,
        tenant: {
          select: { id: true, name: true, slug: true, status: true, plan: true },
        },
      },
    });

    if (!user) return ApiResponse.unauthorized(res, 'User not found');
    if (!user.isActive) return ApiResponse.unauthorized(res, 'Account deactivated');
    if (user.tenantId && user.tenant?.status === 'SUSPENDED') {
      return ApiResponse.forbidden(res, 'Tenant account is suspended');
    }

    req.user = user;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return ApiResponse.unauthorized(res, 'Token expired');
    }
    return ApiResponse.unauthorized(res, 'Invalid token');
  }
};

const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) return ApiResponse.unauthorized(res);
    if (!roles.includes(req.user.role)) {
      return ApiResponse.forbidden(res, 'Insufficient permissions');
    }
    next();
  };
};

module.exports = { authenticate, authorize };
