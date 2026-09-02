const File = require('../models/File');
const { processUpload } = require('../utils/fileUpload');

exports.uploadFile = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No file uploaded'
      });
    }

    const uploadInfo = await processUpload(req.file, req.fileCategory);

    const savedFile = await File.create({
      originalName: uploadInfo.originalName,
      storagePath: uploadInfo.storagePath,
      mimeType: uploadInfo.mimeType,
      size: uploadInfo.size,
      category: uploadInfo.category,
      uploadedBy: req.user?._id || null
    });

    res.json({
      success: true,
      fileId: savedFile._id,
      url: uploadInfo.url,
      file: uploadInfo
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
};
