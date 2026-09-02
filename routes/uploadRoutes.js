const express = require('express');
const router = express.Router();

const { uploadSingle } = require('../utils/fileUpload');
const { uploadFile } = require('../controllers/uploadController');

router.post(
  '/upload',
  uploadSingle('file'),
  uploadFile
);

module.exports = router;
