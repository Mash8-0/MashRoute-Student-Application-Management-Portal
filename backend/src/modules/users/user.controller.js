const userService = require('./user.service');
const ApiResponse = require('../../utils/apiResponse');
const asyncHandler = require('../../utils/asyncHandler');

const createUser = asyncHandler(async (req, res) => {
  const tenantId = req.tenantId || req.user.tenantId;
  const user = await userService.createUser(tenantId, req.body, req.user.role);
  return ApiResponse.created(res, user, 'User created successfully');
});

const listUsers = asyncHandler(async (req, res) => {
  const tenantId = req.tenantId || req.user.tenantId;
  const result = await userService.listUsers(tenantId, req.query);
  return ApiResponse.paginated(res, result.users, result.pagination);
});

const getUser = asyncHandler(async (req, res) => {
  const tenantId = req.user.role !== 'SUPER_ADMIN' ? req.user.tenantId : null;
  const user = await userService.getUser(req.params.id, tenantId);
  return ApiResponse.success(res, user);
});

const updateUser = asyncHandler(async (req, res) => {
  const tenantId = req.user.tenantId;
  const user = await userService.updateUser(req.params.id, tenantId, req.body);
  return ApiResponse.success(res, user, 'User updated');
});

const resetUserPassword = asyncHandler(async (req, res) => {
  const { newPassword } = req.body;
  if (!newPassword || newPassword.length < 8) {
    return ApiResponse.error(res, 'New password must be at least 8 characters', 400);
  }
  await userService.resetUserPassword(req.params.id, newPassword);
  return ApiResponse.success(res, null, 'Password reset successfully');
});

const deleteUser = asyncHandler(async (req, res) => {
  if (req.params.id === req.user.id) {
    return ApiResponse.error(res, 'Cannot delete your own account', 400);
  }
  await userService.deleteUser(req.params.id);
  return ApiResponse.success(res, null, 'User deleted');
});

module.exports = { createUser, listUsers, getUser, updateUser, resetUserPassword, deleteUser };
