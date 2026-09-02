const multer = require('multer');
const fs = require('fs');
const path = require('path');

const uploadDir = path.join(__dirname, '..', 'uploads');

fs.mkdirSync(uploadDir, { recursive: true });

/* ===================== MULTER CONFIG ===================== */

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const extension = path.extname(file.originalname).toLowerCase();
    const baseName = path.basename(file.originalname, extension).replace(/[^a-zA-Z0-9._-]/g, '_');
    cb(null, `${Date.now()}-${baseName}${extension}`);
  }
});

const upload = multer({
  storage,
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

  const allowedExtensions = {
    image: ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.tiff'],
    document: ['.pdf', '.doc', '.docx', '.ppt', '.pptx', '.xls', '.xlsx'],
    video: ['.mp4', '.mkv', '.avi', '.mov', '.webm', '.flv', '.wmv'],
    audio: ['.mp3', '.wav', '.ogg', '.m4a', '.aac', '.flac'],
    text: ['.txt', '.csv', '.json', '.js', '.py', '.java', '.html', '.css', '.md']
  };

  const allAllowed = Object.values(allowedTypes).flat();
  const extension = path.extname(file.originalname || '').toLowerCase();

  for (const [category, types] of Object.entries(allowedTypes)) {
    if (types.includes(file.mimetype)) {
      req.fileCategory = category;
      return cb(null, true);
    }
  }

  for (const [category, extensions] of Object.entries(allowedExtensions)) {
    if (extensions.includes(extension)) {
      req.fileCategory = category;
      return cb(null, true);
    }
  }

  cb(new Error(`Unsupported file type: ${file.mimetype || 'unknown'} (${extension || 'no extension'})`), false);
}

/* ===================== PROCESS UPLOAD ===================== */
/**
 * Stores file locally through Multer disk storage.
 */
const processUpload = async (file, category = null) => {
  if (!file || !file.path) {
    throw new Error('No file received');
  }

  const extension = path.extname(file.originalname).toLowerCase();
  const storagePath = file.filename;

  return {
    originalName: file.originalname,
    storagePath,
    localPath: file.path,
    url: `/uploads/${storagePath}`,
    mimeType: file.mimetype,
    size: file.size,
    category: category || 'other',
    extension,
    uploadedAt: new Date().toISOString(),
    storage: 'local'
  };
};

/* ===================== CLEANUP ===================== */

const cleanupTempFiles = async (files = []) => {
  const fileList = Array.isArray(files) ? files : [files];
  await Promise.all(fileList.filter(Boolean).map(async (file) => {
    const filePath = typeof file === 'string' ? file : file.path;
    if (!filePath) return;
    await fs.promises.unlink(filePath).catch(() => {});
  }));
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
