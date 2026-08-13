const express = require('express');
const router = express.Router();
const controller = require('./user.controller');
const { authenticate, authorize } = require('../../middleware/auth.middleware');
const { tenantContext } = require('../../middleware/tenant.middleware');

router.use(authenticate, tenantContext);

router.get('/', authorize('SUPER_ADMIN', 'TENANT_ADMIN'), controller.listUsers);
router.post('/', authorize('SUPER_ADMIN', 'TENANT_ADMIN'), controller.createUser);
router.get('/:id', authorize('SUPER_ADMIN', 'TENANT_ADMIN'), controller.getUser);
router.patch('/:id', authorize('SUPER_ADMIN', 'TENANT_ADMIN'), controller.updateUser);
router.post('/:id/reset-password', authorize('SUPER_ADMIN', 'TENANT_ADMIN'), controller.resetUserPassword);
router.delete('/:id', authorize('SUPER_ADMIN', 'TENANT_ADMIN'), controller.deleteUser);

module.exports = router;
