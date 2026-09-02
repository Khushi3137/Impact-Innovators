const multer = require('multer');
const path = require('path');
const supabase = require('../config/supabase');

/* ===================== MULTER CONFIG ===================== */

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB
    files: 10,
    fields: 20
  },
  fileFilter
});

// Upload helpers
const uploadSingle = (fieldName) => upload.single(fieldName);
const uploadMultiple = (fieldName, maxCount = 10) =>
  upload.array(fieldName, maxCount);
const uploadFields = (fields) => upload.fields(fields);

/* ===================== FILE FILTER ===================== */

function fileFilter(req, file, cb) {
  const allowedTypes = {
    image: [
      'image/jpeg', 'image/png', 'image/jpg', 'image/gif',
      'image/webp', 'image/bmp', 'image/tiff'
    ],
    document: [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ],
    video: [
      'video/mp4', 'video/mkv', 'video/avi',
      'video/mov', 'video/webm', 'video/flv', 'video/wmv'
    ],
    audio: [
      'audio/mpeg', 'audio/wav', 'audio/ogg',
      'audio/m4a', 'audio/aac', 'audio/flac'
    ],
    text: [
      'text/plain', 'text/csv', 'application/json',
      'text/html', 'text/css', 'text/javascript'
    ]
  };

  const allAllowed = Object.values(allowedTypes).flat();

  if (!allAllowed.includes(file.mimetype)) {
    return cb(new Error(`Unsupported file type: ${file.mimetype}`), false);
  }

  for (const [category, types] of Object.entries(allowedTypes)) {
    if (types.includes(file.mimetype)) {
      req.fileCategory = category;
      break;
    }
  }

  cb(null, true);
}

/* ===================== PROCESS UPLOAD ===================== */
/**
 * Uploads file directly to Supabase Storage.
 * NO local filesystem usage.
 */
const processUpload = async (file, category = null) => {
  if (!file || !file.buffer) {
    throw new Error('No file buffer received');
  }

  const extension = path.extname(file.originalname).toLowerCase();
  const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
  const storagePath = `${Date.now()}-${safeName}`;

  const { error } = await supabase.storage
    .from(process.env.SUPABASE_BUCKET)
    .upload(storagePath, file.buffer, {
      contentType: file.mimetype,
      upsert: false
    });

  if (error) {
    throw new Error(`Supabase upload failed: ${error.message}`);
  }

  return {
    originalName: file.originalname,
    storagePath,
    mimeType: file.mimetype,
    size: file.size,
    category: category || 'other',
    extension,
    uploadedAt: new Date().toISOString(),
    storage: 'supabase'
  };
};

/* ===================== CLEANUP (NO-OP) ===================== */

const cleanupTempFiles = async () => {
  return;
};

/* ===================== SUPPORTED TYPES ===================== */

const getSupportedTypes = () => ({
  images: ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.tiff'],
  documents: ['.pdf', '.doc', '.docx', '.ppt', '.pptx', '.xls', '.xlsx'],
  videos: ['.mp4', '.mkv', '.avi', '.mov', '.webm', '.flv', '.wmv'],
  audio: ['.mp3', '.wav', '.ogg', '.m4a', '.aac', '.flac'],
  text: ['.txt', '.csv', '.json', '.js', '.py', '.java', '.html', '.css', '.md'],
  maxSize: '100MB',
  maxFiles: 10
});

/* ===================== EXPORTS ===================== */

module.exports = {
  upload,
  uploadSingle,
  uploadMultiple,
  uploadFields,
  processUpload,
  cleanupTempFiles,
  getSupportedTypes
};

