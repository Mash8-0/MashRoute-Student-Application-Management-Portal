const ApiResponse = require('../utils/apiResponse');

// Injects tenantId into req for all tenant-scoped operations.
// SUPER_ADMIN can optionally pass X-Tenant-Id header to operate on behalf of a tenant.
const tenantContext = (req, res, next) => {
  if (!req.user) return ApiResponse.unauthorized(res);

  if (req.user.role === 'SUPER_ADMIN') {
    const overrideTenantId = req.headers['x-tenant-id'];
    req.tenantId = overrideTenantId || null;
  } else {
    if (!req.user.tenantId) {
      return ApiResponse.forbidden(res, 'No tenant associated with this account');
    }
    req.tenantId = req.user.tenantId;
  }

  next();
};

// Ensures the requesting user belongs to the same tenant as the resource.
// Attach to routes where tenantId is in route params.
const requireSameTenant = (req, res, next) => {
  if (req.user.role === 'SUPER_ADMIN') return next();

  const resourceTenantId = req.params.tenantId || req.body.tenantId;
  if (resourceTenantId && resourceTenantId !== req.user.tenantId) {
    return ApiResponse.forbidden(res, 'Cross-tenant access denied');
  }
  next();
};

module.exports = { tenantContext, requireSameTenant };
