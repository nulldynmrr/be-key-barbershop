const packageService = require("../services/package.service");
const {
  packageSchema,
  updatePackageSchema,
} = require("../validations/package.validation");
const cache = require("../utils/memoryCache");

const getLiveHPP = async (req, res, next) => {
  try {
    const result = await packageService.calculateLiveHPP(req.body);
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

const getActivePackages = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const result = await packageService.getAllPackages(page, limit);
    res.status(200).json({
      success: true,
      data: result,
      meta: { page, limit, total: result.total },
    });
  } catch (error) {
    next(error);
  }
};

const createPackage = async (req, res, next) => {
  try {
    const validatedData = packageSchema.parse(req.body);
    const data = await packageService.createNewPackage(validatedData);
    cache.clear();
    if (req.log)
      req.log.info({ packageId: data.id }, "Paket baru sukses dibuat");
    res
      .status(201)
      .json({ success: true, message: "Paket aman dan berhasil dibuat", data });
  } catch (error) {
    if (error.name === "ZodError") {
      return res.status(400).json({ success: false, errors: error.errors });
    }
    next(error);
  }
};

const updatePackage = async (req, res, next) => {
  try {
    const { id } = req.params;
    const validatedData = updatePackageSchema.parse(req.body);
    const updatedData = await packageService.updatePackageById(
      id,
      validatedData,
    );
    cache.clear();
    if (req.log) req.log.info({ packageId: id }, "Paket sukses diupdate");
    res.status(200).json({
      success: true,
      message: "Paket berhasil diupdate",
      data: updatedData,
    });
  } catch (error) {
    if (error.name === "ZodError") {
      return res.status(400).json({ success: false, errors: error.errors });
    }
    next(error);
  }
};

const deletePackage = async (req, res, next) => {
  try {
    const { id } = req.params;
    await packageService.deletePackageById(id);
    cache.clear(); // Bersihkan cache
    if (req.log) req.log.info({ packageId: id }, "Paket sukses dihapus");
    res.status(200).json({ success: true, message: "Paket berhasil dihapus" });
  } catch (error) {
    next(error);
  }
};

const togglePackageStatus = async (req, res, next) => {
  try {
    const { status } = req.body;
    await packageService.togglePackageStatus(req.params.id, status);
    cache.clear();
    res.status(200).json({
      success: true,
      message: `Paket berhasil di-${status === "AKTIF" ? "aktifkan" : "nonaktifkan"}`,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getLiveHPP,
  getActivePackages,
  createPackage,
  updatePackage,
  deletePackage,
  togglePackageStatus,
};
