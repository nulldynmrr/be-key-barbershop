const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
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

    res.status(200).json({ success: true, data: galleries });
  } catch (error) {
    res.status(500).json({ success: false, message: "Terjadi kesalahan server: " + error.message });
  }
};

exports.createGallery = async (req, res) => {
  try {
    const { kategori } = req.body;

    if (!req.file) {
      return res.status(400).json({ success: false, message: "Gambar wajib diunggah" });
    }
    if (!kategori) {
      return res.status(400).json({ success: false, message: "Kategori wajib diisi" });
    }

    const url_foto_gallery = `/uploads/gallery/${req.file.filename}`;

    const newGallery = await prisma.gallery.create({
      data: {
        url_foto_gallery,
        kategori,
      },
    });

    res.status(201).json({ success: true, data: newGallery });
  } catch (error) {
    res.status(500).json({ success: false, message: "Gagal menyimpan data: " + error.message });
  }
};

exports.deleteGallery = async (req, res) => {
  try {
    const { id } = req.params;

    const existingGallery = await prisma.gallery.findUnique({
      where: { id: parseInt(id) }
    });

    if (!existingGallery) {
      return res.status(404).json({ success: false, message: "Gallery tidak ditemukan" });
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

    res.status(200).json({ success: true, message: "Gallery berhasil dihapus beserta filenya" });
  } catch (error) {
    res.status(500).json({ success: false, message: "Gagal menghapus data: " + error.message });
  }
};
