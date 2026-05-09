const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

exports.getSocialMedias = async (req, res) => {
  try {
    const socialMedias = await prisma.socialMedia.findMany({
      orderBy: { createdAt: 'desc' }
    });
    res.status(200).json({ success: true, data: socialMedias });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.createSocialMedia = async (req, res) => {
  try {
    const { title, link } = req.body;

    if (!title || !link) {
      return res.status(400).json({ success: false, message: "Title dan link harus diisi" });
    }

    const newSocialMedia = await prisma.socialMedia.create({
      data: {
        title,
        link,
      },
    });

    res.status(201).json({ success: true, data: newSocialMedia });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.deleteSocialMedia = async (req, res) => {
  try {
    const { id } = req.params;

    const existingSocialMedia = await prisma.socialMedia.findUnique({
      where: { id: parseInt(id) }
    });

    if (!existingSocialMedia) {
      return res.status(404).json({ success: false, message: "Media Sosial tidak ditemukan" });
    }

    await prisma.socialMedia.delete({
      where: { id: parseInt(id) },
    });

    res.status(200).json({ success: true, message: "Media Sosial berhasil dihapus" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
