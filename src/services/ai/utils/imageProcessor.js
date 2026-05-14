const sharp = require("sharp");

const MAX_FILE_SIZE = 5 * 1024 * 1024;

/**
 * Memastikan gambar di bawah limit MAX_FILE_SIZE dengan kompresi Sharp.
 * @param {object} file Express Multer File object
 * @returns {Promise<object>} Modified file object
 */
const compressImageIfNeeded = async (file) => {
  if (file.size > MAX_FILE_SIZE) {
    const source = file.buffer || file.path;
    let quality = 70;
    let compressedBuffer = await sharp(source).webp({ quality }).toBuffer();

    while (compressedBuffer.length > MAX_FILE_SIZE && quality > 20) {
      quality -= 10;
      compressedBuffer = await sharp(source).webp({ quality }).toBuffer();
    }

    file.buffer = compressedBuffer;
    file.size = compressedBuffer.length;
    file.mimetype = "image/webp";
    file.originalname = file.originalname.replace(/\.[^.]+$/, ".webp");
  }
  return file;
};

module.exports = { compressImageIfNeeded, MAX_FILE_SIZE };
