const prisma = require("../config/prisma");
const { success, error: sendError } = require("../utils/response.helper");

exports.getAllBarbers = async (req, res) => {
  try {
    const barbers = await prisma.barber.findMany();
    return success(res, { data: barbers });
  } catch (error) {
    return sendError(res, { message: error.message });
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

    return success(res, { statusCode: 201, data: newBarber });
  } catch (error) {
    return sendError(res, { message: error.message });
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
      return sendError(res, { message: "Barber tidak ditemukan", statusCode: 404 });
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

    return success(res, { data: updatedBarber });
  } catch (error) {
    return sendError(res, { message: error.message });
  }
};

exports.deleteBarber = async (req, res) => {
  try {
    const { id } = req.params;

    const existingBarber = await prisma.barber.findUnique({
      where: { id: parseInt(id) }
    });

    if (!existingBarber) {
      return sendError(res, { message: "Barber tidak ditemukan", statusCode: 404 });
    }

    await prisma.barber.delete({
      where: { id: parseInt(id) },
    });

    return success(res, { message: "Barber berhasil dihapus" });
  } catch (error) {
    return sendError(res, { message: error.message });
  }
};
