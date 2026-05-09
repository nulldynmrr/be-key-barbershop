const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

exports.getAllBarbers = async (req, res) => {
  try {
    const barbers = await prisma.barber.findMany();
    res.status(200).json({ success: true, data: barbers });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.createBarber = async (req, res) => {
  try {
    const { nama_kapster, spesialisasi, pengalaman } = req.body;

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

exports.updateBarber = async (req, res) => {
  try {
    const { id } = req.params;
    const { nama_kapster, spesialisasi, pengalaman } = req.body;

    const existingBarber = await prisma.barber.findUnique({
      where: { id: parseInt(id) }
    });

    if (!existingBarber) {
      return res.status(404).json({ success: false, message: "Barber tidak ditemukan" });
    }

    const dataToUpdate = {};
    if (nama_kapster !== undefined) dataToUpdate.nama_kapster = nama_kapster;
    if (spesialisasi !== undefined) dataToUpdate.spesialisasi = spesialisasi;
    if (pengalaman !== undefined) dataToUpdate.pengalaman = parseInt(pengalaman);

    if (req.file) {
      dataToUpdate.url_foto_upload = `/uploads/barbers/${req.file.filename}`;
    }

    const updatedBarber = await prisma.barber.update({
      where: { id: parseInt(id) },
      data: dataToUpdate,
    });

    res.status(200).json({ success: true, data: updatedBarber });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.deleteBarber = async (req, res) => {
  try {
    const { id } = req.params;

    const existingBarber = await prisma.barber.findUnique({
      where: { id: parseInt(id) }
    });

    if (!existingBarber) {
      return res.status(404).json({ success: false, message: "Barber tidak ditemukan" });
    }

    await prisma.barber.delete({
      where: { id: parseInt(id) },
    });

    res.status(200).json({ success: true, message: "Barber berhasil dihapus" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
