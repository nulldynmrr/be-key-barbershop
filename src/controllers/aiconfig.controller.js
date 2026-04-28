const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
const { encrypt } = require("../utils/encryption");

exports.getAllConfigs = async (req, res) => {
  try {
    const configs = await prisma.aiModelConfig.findMany();
    res.status(200).json({ success: true, data: configs });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.createConfig = async (req, res) => {
  try {
    const data = req.body;

    if (
      !data.router_name ||
      !data.api_key ||
      !data.model_name ||
      !data.tipe_ai
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Kolom router_name, api_key, model_name, dan tipe_ai WAJIB diisi!",
      });
    }

    data.api_key = encrypt(data.api_key);

    const newConfig = await prisma.aiModelConfig.create({ data });
    res
      .status(201)
      .json({ success: true, message: "Berhasil ditambah", data: newConfig });
  } catch (error) {
    if (error.code === "P2002") {
      return res.status(400).json({
        success: false,
        message:
          "tipe_ai ini sudah ada di database. Silakan gunakan tipe_ai lain atau edit yang sudah ada.",
      });
    }
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.updateConfig = async (req, res) => {
  try {
    const { id } = req.params;
    let dataUpdate = { ...req.body };

    if (dataUpdate.api_key) {
      dataUpdate.api_key = encrypt(dataUpdate.api_key);
    }

    const updatedConfig = await prisma.aiModelConfig.update({
      where: { id: Number(id) },
      data: dataUpdate,
    });

    res.status(200).json({
      success: true,
      message: "Berhasil diupdate",
      data: updatedConfig,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.deleteConfig = async (req, res) => {
  try {
    const { id } = req.params;

    await prisma.aiModelConfig.delete({
      where: { id: Number(id) },
    });

    res.status(200).json({
      success: true,
      message: "Config berhasil dihapus",
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
