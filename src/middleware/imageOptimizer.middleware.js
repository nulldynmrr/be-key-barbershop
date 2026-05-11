const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const optimizeImage = async (req, res, next) => {
  if (!req.file) {
    return next();
  }

  if (!req.file.mimetype.startsWith('image/')) {
    return next();
  }

  try {
    if (req.file.buffer) {
      const optimizedBuffer = await sharp(req.file.buffer)
        .webp({ quality: 80 })
        .toBuffer();

      req.file.buffer = optimizedBuffer;
      req.file.mimetype = 'image/webp';
      req.file.size = optimizedBuffer.length;

      if (req.file.originalname) {
        const parsedPath = path.parse(req.file.originalname);
        req.file.originalname = `${parsedPath.name}.webp`;
      }
    } else if (req.file.path) {
      const originalPath = req.file.path;
      const parsedPath = path.parse(originalPath);
      const newFilename = `${parsedPath.name}.webp`;
      const newPath = path.join(parsedPath.dir, newFilename);

      await sharp(originalPath)
        .webp({ quality: 80 })
        .toFile(newPath);

      if (fs.existsSync(originalPath)) {
        fs.unlinkSync(originalPath);
      }

      req.file.filename = newFilename;
      req.file.path = newPath;
      req.file.mimetype = 'image/webp';

      const stats = fs.statSync(newPath);
      req.file.size = stats.size;
    }

    next();
  } catch (error) {
    console.error("Gagal mengoptimasi gambar:", error);
    next();
  }
};

module.exports = optimizeImage;
