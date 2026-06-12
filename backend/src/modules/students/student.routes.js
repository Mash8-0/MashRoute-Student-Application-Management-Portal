const express = require('express');
const router = express.Router();
const controller = require('./student.controller');
const { authenticate, authorize } = require('../../middleware/auth.middleware');
const { tenantContext } = require('../../middleware/tenant.middleware');
const { logActivity } = require('../../middleware/activityLog.middleware');

router.use(authenticate, tenantContext);

router.get('/', controller.listStudents);
router.post('/', authorize('TENANT_ADMIN', 'STAFF', 'SUPER_ADMIN'), logActivity('CREATE', 'Student'), controller.createStudent);
router.get('/:id', controller.getStudent);
router.patch('/:id', authorize('TENANT_ADMIN', 'STAFF', 'SUPER_ADMIN'), logActivity('UPDATE', 'Student'), controller.updateStudent);
router.delete('/:id', authorize('TENANT_ADMIN', 'SUPER_ADMIN'), logActivity('DELETE', 'Student'), controller.deleteStudent);

module.exports = router;
