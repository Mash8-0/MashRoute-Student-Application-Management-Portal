const router = require('express').Router();
const controller = require('./intake.controller');
const { authenticate, authorize } = require('../../middleware/auth.middleware');
const { tenantContext } = require('../../middleware/tenant.middleware');

router.use(authenticate, tenantContext);
router.get('/available', controller.available);
router.post('/late-approvals', controller.requestApproval);
router.get('/late-approvals', authorize('TENANT_ADMIN', 'SUPER_ADMIN'), controller.listApprovals);
router.patch('/late-approvals/:id', authorize('TENANT_ADMIN', 'SUPER_ADMIN'), controller.reviewApproval);
router.get('/settings', authorize('TENANT_ADMIN', 'SUPER_ADMIN'), controller.getSetting);
router.patch('/settings', authorize('TENANT_ADMIN', 'SUPER_ADMIN'), controller.updateSetting);
router.get('/', authorize('TENANT_ADMIN', 'SUPER_ADMIN'), controller.list);
router.post('/', authorize('TENANT_ADMIN', 'SUPER_ADMIN'), controller.create);
router.patch('/bulk-active', authorize('TENANT_ADMIN', 'SUPER_ADMIN'), controller.bulkActive);
router.get('/:id/audit', authorize('TENANT_ADMIN', 'SUPER_ADMIN'), controller.audit);
router.post('/:id/duplicate', authorize('TENANT_ADMIN', 'SUPER_ADMIN'), controller.duplicate);
router.patch('/:id/active', authorize('TENANT_ADMIN', 'SUPER_ADMIN'), controller.setActive);
router.patch('/:id', authorize('TENANT_ADMIN', 'SUPER_ADMIN'), controller.update);

module.exports = router;
