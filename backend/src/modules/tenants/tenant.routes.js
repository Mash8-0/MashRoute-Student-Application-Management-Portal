const express = require('express');
const multer = require('multer');
const path = require('path');
const router = express.Router();
const controller = require('./tenant.controller');
const { authenticate, authorize } = require('../../middleware/auth.middleware');

// Multer for Super Admin direct company creation (logo + license/passport).
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/temp'),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `tenant_${Date.now()}_${Math.round(Math.random() * 1e9)}${ext}`);
  },
});
const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    if (file.fieldname !== 'logo') return cb(null, true);
    return ['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml'].includes(file.mimetype)
      ? cb(null, true)
      : cb(new Error('Logo must be JPEG, PNG, WEBP or SVG'), false);
  },
  limits: { fileSize: 10 * 1024 * 1024 },
});

router.use(authenticate);

router.get('/me', authorize('TENANT_ADMIN'), controller.getMyTenant);
router.post('/me/logo', authorize('TENANT_ADMIN'), upload.single('logo'), controller.updateMyLogo);
router.patch('/me/agent-privacy', authorize('TENANT_ADMIN'), controller.updateAgentPrivacy);

router.use(authorize('SUPER_ADMIN'));

router.get('/stats', controller.getTenantStats);
router.get('/pending/list', controller.listPending);
router.get('/pending/count', controller.getPendingCount);
router.get('/', controller.listTenants);
router.post(
  '/',
  upload.fields([
    { name: 'logo', maxCount: 1 },
    { name: 'verificationDoc', maxCount: 1 },
  ]),
  controller.createTenant
);
router.get('/:id', controller.getTenant);
router.patch('/:id', controller.updateTenant);
router.patch('/:id/approve', controller.approveTenant);
router.patch('/:id/reject', controller.rejectTenant);
router.patch('/:id/suspend', controller.suspendTenant);
router.patch('/:id/activate', controller.activateTenant);
router.delete('/:id', controller.deleteTenant);

module.exports = router;
