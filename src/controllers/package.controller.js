const packageService = require("../services/package.service");
const {
  packageSchema,
  updatePackageSchema,
} = require("../validations/package.validation");
const cache = require("../utils/memoryCache");
const { success, error: sendError } = require("../utils/response.helper");

const getLiveHPP = async (req, res, next) => {
  try {
    const result = await packageService.calculateLiveHPP(req.body);
    return success(res, { data: result });
  } catch (error) {
    return sendError(res, { message: error.message });
  }
};

const getActivePackages = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 10, 100);
    const result = await packageService.getAllPackages(page, limit);
    return success(res, {
      data: result,
      meta: { page, limit, total: result.total },
    });
  } catch (error) {
    return sendError(res, { message: error.message });
  }
};

const createPackage = async (req, res, next) => {
  try {
    const validatedData = packageSchema.parse(req.body);
    const data = await packageService.createNewPackage(validatedData);
    cache.clear();
    if (req.log)
      req.log.info({ packageId: data.id }, "Paket baru sukses dibuat");
    return success(res, { 
      statusCode: 201,
      message: "Paket aman dan berhasil dibuat", 
      data 
    });
  } catch (error) {
    if (error.name === "ZodError") {
      return sendError(res, { statusCode: 400, errors: error.issues.map(e => e.message) });
    }
    return sendError(res, { message: error.message });
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
    return success(res, {
      message: "Paket berhasil diupdate",
      data: updatedData,
    });
  } catch (error) {
    if (error.name === "ZodError") {
      return sendError(res, { statusCode: 400, errors: error.issues.map(e => e.message) });
    }
    return sendError(res, { message: error.message });
  }
};

const deletePackage = async (req, res, next) => {
  try {
    const { id } = req.params;
    await packageService.deletePackageById(id);
    cache.clear();
    if (req.log) req.log.info({ packageId: id }, "Paket sukses dihapus");
    return success(res, { message: "Paket berhasil dihapus" });
  } catch (error) {
    return sendError(res, { message: error.message });
  }
};

const togglePackageStatus = async (req, res, next) => {
  try {
    const { status } = req.body;
    await packageService.togglePackageStatus(req.params.id, status);
    cache.clear();
    return success(res, {
      message: `Paket berhasil di-${status === "AKTIF" ? "aktifkan" : "nonaktifkan"}`,
    });
  } catch (error) {
    return sendError(res, { message: error.message });
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
