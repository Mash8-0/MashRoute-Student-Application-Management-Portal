const express = require('express');
const multer = require('multer');
const path = require('path');
const router = express.Router({ mergeParams: true });
const controller = require('./loe.controller');
const { authenticate } = require('../../middleware/auth.middleware');
const { tenantContext } = require('../../middleware/tenant.middleware');

// ─── Multer (LOE file uploads) ────────────────────────────────────────────────

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/temp'),
  filename: (req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${unique}${path.extname(file.originalname)}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: parseInt(process.env.MAX_FILE_SIZE) || 10 * 1024 * 1024 },
});

// ─── Middleware ───────────────────────────────────────────────────────────────

router.use(authenticate, tenantContext);

// ─── Routes ───────────────────────────────────────────────────────────────────

router.post('/generate', controller.generateLOE);
router.get('/', controller.getLOE);
router.post('/upload', upload.single('file'), controller.uploadLOE);
router.delete('/', controller.deleteLOE);

module.exports = router;
