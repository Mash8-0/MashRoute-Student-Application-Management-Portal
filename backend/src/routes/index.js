const express = require('express');
const router = express.Router();

router.use('/auth', require('../modules/auth/auth.routes'));
router.use('/register-company', require('../modules/registration/registration.routes'));
router.use('/register', require('../modules/registration/registration.routes'));
router.use('/drive-auth', require('./driveAuth.routes'));
router.use('/tenants', require('../modules/tenants/tenant.routes'));
router.use('/users', require('../modules/users/user.routes'));
router.use('/students', require('../modules/students/student.routes'));
router.use('/applications', require('../modules/applications/application.routes'));
router.use('/applications/:applicationId/loe', require('../modules/loe/loe.routes'));
router.use('/documents', require('../modules/documents/document.routes'));
router.use('/payments', require('../modules/payments/payment.routes'));
router.use('/extraction', require('../modules/ai-extraction/extraction.routes'));
router.use('/universities', require('../modules/universities/university.routes'));
router.use('/whatsapp', require('../modules/whatsapp/whatsapp.routes'));
router.use('/analytics', require('../modules/analytics/analytics.routes'));

module.exports = router;
