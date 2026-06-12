const tenantService = require('./tenant.service');
const ApiResponse = require('../../utils/apiResponse');
const asyncHandler = require('../../utils/asyncHandler');

const createTenant = asyncHandler(async (req, res) => {
  const tenant = await tenantService.createTenant(req.body, req.files || {});
  return ApiResponse.created(res, tenant, 'Tenant created successfully');
});

const listTenants = asyncHandler(async (req, res) => {
  const result = await tenantService.listTenants(req.query);
  return ApiResponse.paginated(res, result.tenants, result.pagination);
});

const getTenant = asyncHandler(async (req, res) => {
  const tenant = await tenantService.getTenant(req.params.id);
  return ApiResponse.success(res, tenant);
});

const updateTenant = asyncHandler(async (req, res) => {
  const tenant = await tenantService.updateTenant(req.params.id, req.body);
  return ApiResponse.success(res, tenant, 'Tenant updated');
});

const suspendTenant = asyncHandler(async (req, res) => {
  const tenant = await tenantService.suspendTenant(req.params.id);
  return ApiResponse.success(res, tenant, 'Tenant suspended');
});

const activateTenant = asyncHandler(async (req, res) => {
  const tenant = await tenantService.activateTenant(req.params.id);
  return ApiResponse.success(res, tenant, 'Tenant activated');
});

const deleteTenant = asyncHandler(async (req, res) => {
  await tenantService.deleteTenant(req.params.id);
  return ApiResponse.success(res, null, 'Tenant deleted');
});

const getTenantStats = asyncHandler(async (req, res) => {
  const stats = await tenantService.getTenantStats();
  return ApiResponse.success(res, stats);
});

const listPending = asyncHandler(async (req, res) => {
  const tenants = await tenantService.listPending();
  return ApiResponse.success(res, tenants);
});

const getPendingCount = asyncHandler(async (req, res) => {
  const count = await tenantService.getPendingCount();
  return ApiResponse.success(res, { count });
});

const approveTenant = asyncHandler(async (req, res) => {
  const tenant = await tenantService.approveTenant(req.params.id, req.user.id);
  return ApiResponse.success(res, tenant, 'Tenant approved');
});

const rejectTenant = asyncHandler(async (req, res) => {
  const tenant = await tenantService.rejectTenant(req.params.id, req.user.id, req.body.reason);
  return ApiResponse.success(res, tenant, 'Tenant rejected');
});

module.exports = { createTenant, listTenants, getTenant, updateTenant, suspendTenant, activateTenant, deleteTenant, getTenantStats, listPending, getPendingCount, approveTenant, rejectTenant };
