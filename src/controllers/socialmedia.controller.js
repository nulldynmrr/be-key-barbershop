const prisma = require("../config/prisma");
const { success, error: sendError } = require("../utils/response.helper");

exports.getSocialMedias = async (req, res) => {
  try {
    const socialMedias = await prisma.socialMedia.findMany({
      orderBy: { createdAt: 'desc' }
    });
    return success(res, { data: socialMedias });
  } catch (error) {
    return sendError(res, { message: error.message });
  }
};

exports.createSocialMedia = async (req, res) => {
  try {
    const { title, link } = req.body;

    if (!title || !link) {
      return sendError(res, { message: "Title dan link harus diisi", statusCode: 400 });
    }

    if (!req.file) {
      return sendError(res, { message: "Thumbnail wajib diunggah", statusCode: 400 });
    }

    const thumbnail = `/uploads/social-media/${req.file.filename}`;


    const newSocialMedia = await prisma.socialMedia.create({
      data: {
        title,
        link,
        thumbnail,
      },
    });




    return success(res, { statusCode: 201, data: newSocialMedia });
  } catch (error) {
    return sendError(res, { message: error.message });
  }
};

exports.deleteSocialMedia = async (req, res) => {
  try {
    const { id } = req.params;

    const existingSocialMedia = await prisma.socialMedia.findUnique({
      where: { id: parseInt(id) }
    });

    if (!existingSocialMedia) {
      return sendError(res, { message: "Media Sosial tidak ditemukan", statusCode: 404 });
    }

    await prisma.socialMedia.delete({
      where: { id: parseInt(id) },
    });

    return success(res, { message: "Media Sosial berhasil dihapus" });
  } catch (error) {
    return sendError(res, { message: error.message });
  }
};
