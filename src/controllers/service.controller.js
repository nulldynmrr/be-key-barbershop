const fs = require("fs");
const path = require("path");
const prisma = require("../config/prisma");
const { success, error: sendError } = require("../utils/response.helper");

exports.getAllServices = async (req, res) => {
  try {
    const services = await prisma.service.findMany();
    return success(res, { data: services });
  } catch (error) {
    return sendError(res, { message: error.message });
  }
};

exports.createService = async (req, res) => {
  try {
    let data = { ...req.body };

    // Konversi string dari form-data ke integer
    if (data.harga) data.harga = Number(data.harga);
    if (data.durasi) data.durasi = Number(data.durasi);

    if (req.file) {
      data.image_url = `/uploads/${req.file.filename}`;
    }

    const newService = await prisma.service.create({ data });
    return success(res, {
      statusCode: 201,
      message: "Layanan ditambahkan",
      data: newService,
    });
  } catch (error) {
    return sendError(res, { message: error.message });
  }
};

// PUT: Edit Layanan
exports.updateService = async (req, res) => {
  try {
    const { id } = req.params;
    let dataUpdate = { ...req.body };

    if (dataUpdate.harga) dataUpdate.harga = Number(dataUpdate.harga);
    if (dataUpdate.durasi) dataUpdate.durasi = Number(dataUpdate.durasi);

    if (req.file) {
      dataUpdate.image_url = `/uploads/${req.file.filename}`;

      // Hapus foto lama
      const oldService = await prisma.service.findUnique({
        where: { id: Number(id) },
      });
      if (oldService && oldService.image_url) {
        const oldPath = path.join(__dirname, "../../", oldService.image_url);
        if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
      }
    }

    const updated = await prisma.service.update({
      where: { id: Number(id) },
      data: dataUpdate,
    });

    return success(res, { message: "Layanan diupdate", data: updated });
  } catch (error) {
    return sendError(res, { message: error.message });
  }
};

// DELETE: Hapus Layanan
exports.deleteService = async (req, res) => {
  try {
    const { id } = req.params;

    const service = await prisma.service.findUnique({
      where: { id: Number(id) },
    });
    if (service && service.image_url) {
      const filePath = path.join(__dirname, "../../", service.image_url);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }

    await prisma.service.delete({ where: { id: Number(id) } });
    return success(res, { message: "Layanan dihapus permanen" });
  } catch (error) {
    return sendError(res, { message: error.message });
  }
};
