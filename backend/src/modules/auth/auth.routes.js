const express = require('express');
const { body } = require('express-validator');
const router = express.Router();
const controller = require('./auth.controller');
const { authenticate } = require('../../middleware/auth.middleware');
const validate = require('../../middleware/validate.middleware');

const loginValidation = [
  // Preserve the address as typed (only lowercase). Do NOT strip Gmail dots or
  // +subaddresses — emails are stored with dots intact, so normalizing them here
  // would make any dotted Gmail address (incl. the super admin) fail to log in.
  body('email')
    .isEmail()
    .withMessage('Valid email is required')
    .bail()
    .customSanitizer((v) => (typeof v === 'string' ? v.trim().toLowerCase() : v)),
  body('password').notEmpty().withMessage('Password is required'),
];

const forgotValidation = [
  // Preserve the address as typed (only lowercase). Do NOT strip Gmail dots or
  // +subaddresses — emails are stored with dots intact, so normalizing them here
  // would make any dotted Gmail address (incl. the super admin) fail to log in.
  body('email')
    .isEmail()
    .withMessage('Valid email is required')
    .bail()
    .customSanitizer((v) => (typeof v === 'string' ? v.trim().toLowerCase() : v)),
];

const resetValidation = [
  body('token').notEmpty().withMessage('Reset token is required'),
  body('password')
    .isLength({ min: 8 })
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])/)
    .withMessage('Password must be 8+ chars with uppercase, lowercase, number, and special character'),
];

const changePasswordValidation = [
  body('currentPassword').notEmpty().withMessage('Current password is required'),
  body('newPassword')
    .isLength({ min: 8 })
    .withMessage('New password must be at least 8 characters'),
];

router.post('/login', loginValidation, validate, controller.login);
router.post('/refresh', controller.refresh);
router.post('/logout', authenticate, controller.logout);
router.post('/forgot-password', forgotValidation, validate, controller.forgotPassword);
router.post('/reset-password', resetValidation, validate, controller.resetPassword);
router.post('/change-password', authenticate, changePasswordValidation, validate, controller.changePassword);
router.get('/me', authenticate, controller.getProfile);
router.patch('/me', authenticate, controller.updateProfile);

module.exports = router;
