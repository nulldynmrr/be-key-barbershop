const prisma = require("../config/prisma");
const { success, error: sendError } = require("../utils/response.helper");
const fs = require('fs');
const path = require('path');

exports.getAllGallery = async (req, res) => {
  try {
    const { kategori } = req.query;
    const filter = kategori ? { kategori } : {};

    const galleries = await prisma.gallery.findMany({
      where: filter,
      orderBy: { id: 'desc' }
    });

    return success(res, { data: galleries });
  } catch (error) {
    return sendError(res, { message: "Terjadi kesalahan server: " + error.message });
  }
};

exports.createGallery = async (req, res) => {
  try {
    const { kategori } = req.body;

    if (!req.file) {
      return sendError(res, { message: "Gambar wajib diunggah", statusCode: 400 });
    }
    if (!kategori) {
      return sendError(res, { message: "Kategori wajib diisi", statusCode: 400 });
    }

    const url_foto_gallery = `/uploads/gallery/${req.file.filename}`;

    const newGallery = await prisma.gallery.create({
      data: {
        url_foto_gallery,
        kategori,
      },
    });

    return success(res, { statusCode: 201, data: newGallery });
  } catch (error) {
    return sendError(res, { message: "Gagal menyimpan data: " + error.message });
  }
};

exports.deleteGallery = async (req, res) => {
  try {
    const { id } = req.params;

    const existingGallery = await prisma.gallery.findUnique({
      where: { id: parseInt(id) }
    });

    if (!existingGallery) {
      return sendError(res, { message: "Gallery tidak ditemukan", statusCode: 404 });
    }

    if (existingGallery.url_foto_gallery) {
      const filePath = path.join(__dirname, '../../', existingGallery.url_foto_gallery);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }

    await prisma.gallery.delete({
      where: { id: parseInt(id) },
    });

    return success(res, { message: "Gallery berhasil dihapus beserta filenya" });
  } catch (error) {
    return sendError(res, { message: "Gagal menghapus data: " + error.message });
  }
};
