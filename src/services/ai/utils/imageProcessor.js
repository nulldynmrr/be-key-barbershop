const sharp = require("sharp");

const MAX_FILE_SIZE = 5 * 1024 * 1024;

/**
 * Memastikan gambar di bawah limit MAX_FILE_SIZE dengan kompresi Sharp.
 * @param {object} file Express Multer File object
 * @returns {Promise<object>} Modified file object
 */
const compressImageIfNeeded = async (file) => {
  const source = file.buffer || file.path;
  
  // ALWAYS normalize orientation and ensure high quality for AI
  const pipeline = sharp(source).rotate(); // Auto-rotate based on EXIF
  
  if (file.size > MAX_FILE_SIZE) {
    let quality = 80;
    let compressedBuffer = await pipeline.jpeg({ quality }).toBuffer();

    while (compressedBuffer.length > MAX_FILE_SIZE && quality > 20) {
      quality -= 10;
      compressedBuffer = await sharp(source).rotate().jpeg({ quality }).toBuffer();
    }

    file.buffer = compressedBuffer;
    file.size = compressedBuffer.length;
    file.mimetype = "image/jpeg";
    file.originalname = file.originalname.replace(/\.[^.]+$/, ".jpg");
  } else {
    // Even if not oversized, normalize orientation for AI accuracy
    file.buffer = await pipeline.jpeg({ quality: 95 }).toBuffer();
    file.size = file.buffer.length;
    file.mimetype = "image/jpeg";
    file.originalname = file.originalname.replace(/\.[^.]+$/, ".jpg");
  }
  
  return file;
};

module.exports = { compressImageIfNeeded, MAX_FILE_SIZE };
