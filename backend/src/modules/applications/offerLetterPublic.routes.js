const router = require('express').Router();
const controller = require('./offerLetterPublic.controller');
router.get('/view/:token', controller.view);
router.get('/file/:token', controller.file);
module.exports = router;
