const File = require('../models/File');
const { processUpload } = require('../utils/fileUpload');
const supabase = require('../config/supabase');

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

    // Create signed URL (15 minutes)
    const { data, error } = await supabase.storage
      .from(process.env.SUPABASE_BUCKET)
      .createSignedUrl(uploadInfo.storagePath, 60 * 15);

    if (error) {
      throw new Error(`Signed URL error: ${error.message}`);
    }

    res.json({
      success: true,
      fileId: savedFile._id,
      signedUrl: data.signedUrl
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
};
