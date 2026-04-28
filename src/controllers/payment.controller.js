// src/controllers/payment.controller.js

const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

exports.createPayment = async (req, res) => {
  // ... isi fungsi ...
};

exports.topupManual = async (req, res) => {
  try {
    const { jumlah_credit } = req.body;
    const userId = req.user.id;

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { sisa_credit: { increment: parseInt(jumlah_credit) } },
    });

    res.status(200).json({
      success: true,
      message: `Berhasil nambah ${jumlah_credit} credit!`,
      sisa_credit_sekarang: updatedUser.sisa_credit,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
