const express = require('express');
const multer = require('multer');
const path = require('path');
const router = express.Router();
const controller = require('./document.controller');
const { authenticate } = require('../../middleware/auth.middleware');
const { tenantContext } = require('../../middleware/tenant.middleware');

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/temp'),
  filename: (req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${unique}${path.extname(file.originalname)}`);
  },
});

const fileFilter = (req, file, cb) => {
  const allowed = [
    'image/jpeg', 'image/png', 'image/webp',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ];
  if (allowed.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Allowed: PDF, JPEG, PNG, WEBP, DOC, DOCX'), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: parseInt(process.env.MAX_FILE_SIZE) || 10 * 1024 * 1024 },
});

router.use(authenticate, tenantContext);

// Per-student document routes
router.get('/student/:studentId', controller.listDocuments);
// Per-application document routes
router.get('/application/:applicationId', controller.listByApplication);
router.post('/upload', upload.single('file'), controller.uploadDocument);
router.get('/:id', controller.getDocument);
router.patch('/:id/status', controller.updateDocumentStatus);
router.patch('/:id/verify', controller.verifyDocument);
router.patch('/:id/reject', controller.rejectDocument);
router.put('/:id/replace', upload.single('file'), controller.replaceDocument);
router.delete('/:id', controller.deleteDocument);

module.exports = router;
