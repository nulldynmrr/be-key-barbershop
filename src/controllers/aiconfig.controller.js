import { PrismaClient } from "@prisma/client";
import fetch from "node-fetch";
import { encrypt, decrypt } from "../utils/encryption.js";

const prisma = new PrismaClient();

export const getExchangeSetting = async (req, res, next) => {
  try {
    let config = await prisma.systemConfig.findUnique({ where: { id: 1 } });
    if (!config) {
      config = await prisma.systemConfig.create({
        data: {
          id: 1,
          globalMultiplier: 1.35,
          baseRateUsdIdr: 17332,
          inflationBuffer: 0.05,
          adminFeeFixed: 4500.0,
          mdrPercentage: 0.007,
        },
      });
    }
    res.status(200).json({ success: true, data: config });
  } catch (error) {
    next(error);
  }
};

export const updateExchangeSetting = async (req, res, next) => {
  try {
    const { globalMultiplier, baseRateUsdIdr, inflationBuffer } = req.body;
    const config = await prisma.systemConfig.upsert({
      where: { id: 1 },
      update: { globalMultiplier, baseRateUsdIdr, inflationBuffer },
      create: { id: 1, globalMultiplier, baseRateUsdIdr, inflationBuffer },
    });
    res.status(200).json({
      success: true,
      message: "Master Exchange berhasil disimpan",
      data: config,
    });
  } catch (error) {
    next(error);
  }
};

export const getAiModels = async (req, res, next) => {
  try {
    const models = await prisma.aiModel.findMany({
      orderBy: { namaRouter: "asc" },
    });

    const maskedModels = models.map((m) => {
      const maskedKey = "********" + m.apiKey.substring(m.apiKey.length - 4);
      return { ...m, apiKey: maskedKey };
    });

    res.status(200).json({ success: true, data: maskedModels });
  } catch (error) {
    next(error);
  }
};

export const saveAiModel = async (req, res, next) => {
  try {
    const { id } = req.params;
    const {
      namaRouter,
      baseUrl,
      modelName,
      apiKey,
      typeAi,
      hargaInput1M,
      hargaOutput1M,
      maxBudget,
      rpmLimit,
      isActive,
    } = req.body;

    let modelConfig;
    if (id) {
      const updateData = {
        namaRouter,
        baseUrl,
        modelName,
        typeAi,
        hargaInput1M,
        hargaOutput1M,
        maxBudget,
        rpmLimit,
        isActive,
      };

      if (apiKey && !apiKey.includes("***")) {
        updateData.apiKey = encrypt(apiKey);
      }

      modelConfig = await prisma.aiModel.update({
        where: { id },
        data: updateData,
      });
    } else {
      if (!apiKey)
        return res.status(400).json({
          success: false,
          message: "API Key wajib diisi untuk model baru!",
        });

      modelConfig = await prisma.aiModel.create({
        data: {
          namaRouter,
          baseUrl,
          modelName,
          typeAi,
          hargaInput1M,
          hargaOutput1M,
          maxBudget,
          rpmLimit,
          isActive,
          apiKey: encrypt(apiKey),
        },
      });
    }
    res.status(200).json({
      success: true,
      message: "Konfigurasi Model AI berhasil disimpan",
      data: modelConfig,
    });
  } catch (error) {
    next(error);
  }
};

export const deleteAiModel = async (req, res, next) => {
  try {
    await prisma.aiModel.delete({ where: { id: req.params.id } });
    res
      .status(200)
      .json({ success: true, message: "Model AI berhasil dihapus" });
  } catch (error) {
    next(error);
  }
};

export const toggleModelStatus = async (req, res, next) => {
  try {
    const { isActive } = req.body;
    await prisma.aiModel.update({
      where: { id: req.params.id },
      data: { isActive },
    });
    res.status(200).json({
      success: true,
      message: `Router berhasil di-${isActive ? "aktifkan" : "matikan"}`,
    });
  } catch (error) {
    next(error);
  }
};

export const testConnection = async (req, res, next) => {
  try {
    let { baseUrl, apiKey, id } = req.body;
    if (!baseUrl)
      return res
        .status(400)
        .json({ success: false, message: "Base URL wajib diisi" });

    if (apiKey && apiKey.includes("***") && id) {
      const existingModel = await prisma.aiModel.findUnique({ where: { id } });
      if (!existingModel)
        return res
          .status(404)
          .json({ success: false, message: "Model tidak ditemukan" });
      apiKey = decrypt(existingModel.apiKey);
    }

    if (!apiKey || apiKey.includes("***")) {
      return res
        .status(400)
        .json({ success: false, message: "API Key tidak valid untuk ditest" });
    }

    const response = await fetch(`${baseUrl}/models`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok)
      throw new Error(`Koneksi Gagal: Error ${response.status}`);
    res
      .status(200)
      .json({ success: true, message: "Koneksi API Berhasil! Sistem siap." });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

export const getAiUsageLogs = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const [total, logs, config] = await Promise.all([
      prisma.systemApiLog.count(),
      prisma.systemApiLog.findMany({
        skip,
        take: limit,
        orderBy: { tgl_penggunaan: "desc" },
        include: { user: { select: { email: true } } },
      }),
      prisma.systemConfig.findUnique({ where: { id: 1 } }),
    ]);

    const globalMultiplier = config?.globalMultiplier || 1.35;
    const formattedLogs = logs.map((log) => {
      const modalUsd = Number(log.cost_usd);
      const chargeUsd = modalUsd * globalMultiplier;
      const profitUsd = chargeUsd - modalUsd;
      return {
        id: log.id,
        timestamp: log.tgl_penggunaan,
        email_user: log.user?.email || "Unknown",
        tokens_in_out: `${log.input_tokens} / ${log.output_tokens}`,
        modal_api_usd: `$${modalUsd.toFixed(5)}`,
        charge_user_usd: `$${chargeUsd.toFixed(5)}`,
        profit_usd: `+$${profitUsd.toFixed(5)}`,
      };
    });

    res.status(200).json({
      success: true,
      data: formattedLogs,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    next(error);
  }
};
