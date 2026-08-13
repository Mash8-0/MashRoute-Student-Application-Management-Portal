const express = require('express');
const multer = require('multer');
const path = require('path');
const router = express.Router();
const controller = require('./registration.controller');

// PUBLIC route — no authentication. Used for SaaS self-service onboarding.
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/temp'),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `reg_${Date.now()}_${Math.round(Math.random() * 1e9)}${ext}`);
  },
});

const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } });

router.post(
  '/',
  upload.fields([
    { name: 'logo', maxCount: 1 },
    { name: 'verificationDoc', maxCount: 1 },
  ]),
  controller.registerCompany
);

module.exports = router;
