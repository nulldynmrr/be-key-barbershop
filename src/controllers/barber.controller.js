const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

// Ambil semua Barber
exports.getAllBarbers = async (req, res) => {
  try {
    const barbers = await prisma.barber.findMany();
    res.status(200).json({ success: true, data: barbers });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Tambah Barber Baru
exports.createBarber = async (req, res) => {
  try {
    const { nama_kapster, spesialisasi, pengalaman } = req.body;

    // Field di database kamu namanya url_foto_upload
    const url_foto_upload = req.file
      ? `/uploads/barbers/${req.file.filename}`
      : null;

    const newBarber = await prisma.barber.create({
      data: {
        nama_kapster,
        spesialisasi,
        pengalaman: parseInt(pengalaman) || 0,
        url_foto_upload,
      },
    });

    res.status(201).json({ success: true, data: newBarber });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
