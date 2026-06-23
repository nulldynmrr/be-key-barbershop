const prisma = require("../config/prisma");
const { success, error: sendError } = require("../utils/response.helper");
const { getEffectivePackagePriceIdr } = require("../services/package.service");
const axios = require("axios");
const crypto = require("crypto");

const generateDokuSignature = (
  clientId,
  requestId,
  requestTimestamp,
  requestTarget,
  body,
  secretKey,
) => {
  const minifiedBody = JSON.stringify(body);
  const digestHash = crypto
    .createHash("sha256")
    .update(minifiedBody, "utf8")
    .digest();
  const digest = digestHash.toString("base64");
  const signatureString = `Client-Id:${clientId}\nRequest-Id:${requestId}\nRequest-Timestamp:${requestTimestamp}\nRequest-Target:${requestTarget}\nDigest:${digest}`;
  const hmac = crypto
    .createHmac("sha256", secretKey)
    .update(signatureString, "utf8")
    .digest();
  return `HMACSHA256=${hmac.toString("base64")}`;
};

exports.createPayment = async (req, res) => {
  try {
    const { plan, price, tier, method, doku_payment_method } = req.body;

    const amountStr = price ? price.replace(/[^0-9]/g, "") : "0";
    const amount = parseInt(amountStr, 10);

    if (!amount || amount <= 0) {
      return sendError(res, { message: "Invalid amount", statusCode: 400 });
    }

    const clientId = process.env.DOKU_CLIENT_ID;
    const secretKey = process.env.DOKU_SECRET_KEY;
    const dokuUrl = process.env.DOKU_API_URL || "https://api-sandbox.doku.com";
    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";
    const requestTarget = "/checkout/v1/payment";

    const requestId = crypto.randomUUID();
    const timestamp = new Date().toISOString().split(".")[0] + "Z";
    const invoiceNumber = `INV-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    const callbackUrl = `${frontendUrl}/payment/callback?invoice=${invoiceNumber}`;

    const requestBody = {
      order: {
        amount: amount,
        invoice_number: invoiceNumber,
        currency: "IDR",
        callback_url: callbackUrl,
        auto_redirect: true,
        line_items: [
          {
            name: plan || "Service Premium",
            price: amount,
            quantity: 1,
          },
        ],
      },
      payment: {
        payment_due_date: 60,
      },
    };

    if (doku_payment_method) {
      requestBody.payment.payment_method_types = [doku_payment_method];
    }

    const signature = generateDokuSignature(
      clientId,
      requestId,
      timestamp,
      requestTarget,
      requestBody,
      secretKey,
    );

    const response = await axios.post(
      `${dokuUrl}${requestTarget}`,
      requestBody,
      {
        headers: {
          "Client-Id": clientId,
          "Request-Id": requestId,
          "Request-Timestamp": timestamp,
          Signature: signature,
          "Content-Type": "application/json",
        },
      },
    );

    if (response.data?.response?.payment?.url) {
      return success(res, {
        message: "Payment link generated successfully",
        data: {
          payment_url: response.data.response.payment.url,
        },
      });
    } else {
      return sendError(res, {
        message: "Failed to retrieve DOKU payment URL",
        statusCode: 500,
      });
    }
  } catch (error) {
    console.error(
      "DOKU Checkout Error:",
      error?.response?.data || error.message,
    );
    return sendError(res, {
      message: error?.response?.data?.error?.message || "Error initializing payment gateway",
      statusCode: 500,
    });
  }
};

exports.topupManual = async (req, res) => {
  try {
    const { jumlah_credit } = req.body;
    const userId = req.user.id;

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { sisa_credit: { increment: parseInt(jumlah_credit) } },
    });

    return success(res, {
      message: `Berhasil menambah ${jumlah_credit} credit.`,
      data: { sisa_credit_sekarang: updatedUser.sisa_credit },
    });
  } catch (error) {
    return sendError(res, { message: error.message });
  }
};

exports.createTransaction = async (req, res) => {
  let transaction = null;
  let invoiceNumber = null;

  try {
    const { package_id, amount, nama_paket } = req.body;
    const userId = req.user.id;

    if (!package_id || !amount) {
      return sendError(res, {
        message: "package_id dan amount wajib diisi",
        statusCode: 400,
      });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return sendError(res, {
        message: "User tidak ditemukan. Silakan login ulang.",
        statusCode: 404,
      });
    }

    const pkg = await prisma.subscriptionPackage.findUnique({
      where: { id: package_id },
    });

    if (!pkg) {
      return sendError(res, {
        message: "Paket tidak ditemukan.",
        statusCode: 404,
      });
    }

    const clientId = process.env.DOKU_CLIENT_ID;
    const secretKey = process.env.DOKU_SECRET_KEY;
    const dokuUrl = process.env.DOKU_API_URL || "https://api-sandbox.doku.com";
    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";
    const requestTarget = "/checkout/v1/payment";

    const requestId = crypto.randomUUID();
    const timestamp = new Date().toISOString().split(".")[0] + "Z";
    invoiceNumber = `INV-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    // Buat record transaksi PENDING terlebih dahulu
    transaction = await prisma.transaction.create({
      data: {
        user_id: userId,
        jenis_transaksi: "BUY_PACKAGE",
        nominal: amount,
        status: "PENDING",
        invoice_number: invoiceNumber,
        package_id: package_id,
        payment_method: req.body.doku_payment_method || "DOKU",
      },
    });

    // callback_url: halaman yang dibuka DOKU setelah user bayar (redirect user kembali)
    const callbackUrl = `${frontendUrl}/payment/callback?invoice=${invoiceNumber}`;

    // notification_url: webhook DOKU kirim konfirmasi ke backend (dikonfigurasi di dashboard DOKU)
    // Atau bisa di-override via additional_info
    const backendUrl = process.env.BACKEND_URL || `http://localhost:${process.env.PORT || 5000}`;

    const requestBody = {
      order: {
        amount: Math.floor(amount),
        invoice_number: invoiceNumber,
        currency: "IDR",
        callback_url: callbackUrl,
        auto_redirect: true,
        line_items: [
          {
            name: nama_paket || pkg.namaPaket || "Service Premium",
            price: Math.floor(amount),
            quantity: 1,
          },
        ],
      },
      payment: {
        payment_due_date: 60,
      },
      additional_info: {
        notification_url: `${backendUrl}/api/v1/payments/notification`,
      },
    };

    if (req.body.doku_payment_method) {
      requestBody.payment.payment_method_types = [req.body.doku_payment_method];
    }

    const signature = generateDokuSignature(
      clientId,
      requestId,
      timestamp,
      requestTarget,
      requestBody,
      secretKey,
    );

    const dokuResponse = await axios.post(
      `${dokuUrl}${requestTarget}`,
      requestBody,
      {
        headers: {
          "Client-Id": clientId,
          "Request-Id": requestId,
          "Request-Timestamp": timestamp,
          Signature: signature,
          "Content-Type": "application/json",
        },
      },
    );

    if (dokuResponse.data?.response?.payment?.url) {
      console.log(`✅ DOKU Payment URL created for invoice ${invoiceNumber}`);
      return success(res, {
        message: "Silakan lanjutkan ke pembayaran",
        data: {
          payment_url: dokuResponse.data.response.payment.url,
          invoice_number: invoiceNumber,
          transaction_id: transaction.id,
        },
      });
    } else {
      // Jika DOKU tidak return URL, kembalikan error
      console.error("DOKU response tidak memiliki payment URL:", dokuResponse.data);
      // Hapus transaksi yang sudah dibuat
      await prisma.transaction.delete({ where: { id: transaction.id } });
      return sendError(res, {
        message: "Gagal mendapatkan link pembayaran dari DOKU",
        statusCode: 500,
      });
    }
  } catch (error) {
    console.error(
      "Create Transaction Error:",
      error?.response?.data || error.message,
    );

    // Hapus transaksi pending yang sudah dibuat jika ada error
    if (transaction) {
      try {
        await prisma.transaction.delete({ where: { id: transaction.id } });
      } catch (deleteErr) {
        console.error("Failed to delete pending transaction:", deleteErr.message);
      }
    }

    return sendError(res, {
      message:
        error?.response?.data?.error?.message || "Error membuat transaksi",
      statusCode: 500,
    });
  }
};

/**
 * GET /payments/status/:invoice
 * Frontend polling untuk cek status pembayaran berdasarkan invoice number
 */
exports.getTransactionStatus = async (req, res) => {
  try {
    const { invoice } = req.params;

    if (!invoice) {
      return sendError(res, { message: "Invoice number wajib diisi", statusCode: 400 });
    }

    const transaction = await prisma.transaction.findUnique({
      where: { invoice_number: invoice },
      include: { package: true },
    });

    if (!transaction) {
      return sendError(res, {
        message: "Transaksi tidak ditemukan",
        statusCode: 404,
      });
    }

    // Pastikan hanya user pemilik transaksi atau admin yang bisa cek
    const userId = req.user?.id;
    if (userId && transaction.user_id !== userId) {
      return sendError(res, {
        message: "Tidak diizinkan mengakses transaksi ini",
        statusCode: 403,
      });
    }

    return success(res, {
      message: "Status transaksi",
      data: {
        status: transaction.status,
        invoice_number: transaction.invoice_number,
        package_name: transaction.package?.namaPaket,
        nominal: transaction.nominal,
        created_at: transaction.created_at,
        updated_at: transaction.updated_at,
      },
    });
  } catch (error) {
    console.error("Get Transaction Status Error:", error);
    return sendError(res, { message: "Error mengambil status transaksi", statusCode: 500 });
  }
};

exports.buyPackage = async (req, res) => {
  try {
    const { package_id } = req.body;
    const userId = req.user.id;

    const pkg = await prisma.subscriptionPackage.findUnique({
      where: { id: package_id },
    });

    if (!pkg) {
      return sendError(res, {
        message: "Paket tidak ditemukan.",
        statusCode: 404,
      });
    }

    const nominalDibayar = getEffectivePackagePriceIdr(pkg);

    const result = await prisma.$transaction(async (tx) => {
      await tx.userPackageBalance.upsert({
        where: {
          user_id_package_id: {
            user_id: userId,
            package_id: pkg.id,
          },
        },
        update: {
          coins_purchased: { increment: pkg.jumlahKoin },
          coins_remaining: { increment: pkg.jumlahKoin },
        },
        create: {
          user_id: userId,
          package_id: pkg.id,
          coins_purchased: pkg.jumlahKoin,
          coins_remaining: pkg.jumlahKoin,
        },
      });

      const allBalances = await tx.userPackageBalance.findMany({
        where: { user_id: userId },
        select: { coins_remaining: true },
      });

      const totalCoins = allBalances.reduce(
        (sum, b) => sum + b.coins_remaining,
        0,
      );

      const updatedUser = await tx.user.update({
        where: { id: userId },
        data: {
          sisa_credit: totalCoins,
          active_package_id: pkg.id,
          status_langganan: true,
          tipe_akun: "premium",
        },
        include: { active_package: true },
      });

      await tx.transaction.create({
        data: {
          user_id: userId,
          jenis_transaksi: "BUY_PACKAGE",
          nominal: nominalDibayar,
          status: "SUCCESS",
          payment_method: "MANUAL",
        },
      });

      return updatedUser;
    });

    return success(res, {
      message: `Berhasil membeli paket ${pkg.namaPaket}.`,
      data: {
        sisa_credit_sekarang: result.sisa_credit,
        active_package: result.active_package?.namaPaket || pkg.namaPaket,
      },
    });
  } catch (error) {
    return sendError(res, { message: error.message });
  }
};

/**
 * POST /payments/notification
 * Webhook dari DOKU (dikonfigurasi di DOKU Dashboard atau via additional_info.notification_url)
 * DOKU kirim notifikasi ini setelah pembayaran berhasil/gagal
 */
exports.paymentNotification = async (req, res) => {
  try {
    console.log("📥 DOKU Notification received:", JSON.stringify(req.body, null, 2));
    console.log("📥 DOKU Notification headers:", req.headers);

    const body = req.body;

    // Format notification DOKU:
    // { order: { invoice_number, amount }, transaction: { status, date }, ... }
    const invoiceNumber = body?.order?.invoice_number;
    const transactionStatus = body?.transaction?.status; // PAID, FAILED, PENDING, EXPIRED

    if (!invoiceNumber) {
      console.error("❌ Notification tanpa invoice_number");
      return res.status(200).json({ status: "OK" }); // Selalu 200 agar DOKU tidak retry
    }

    // Verifikasi signature DOKU (opsional tapi direkomendasikan)
    // DOKU mengirim signature di header: Signature
    const receivedSignature = req.headers["signature"] || req.headers["Signature"];
    if (receivedSignature && process.env.DOKU_SECRET_KEY) {
      // Verifikasi bisa dilakukan di sini jika diperlukan
      console.log("🔐 DOKU Signature received:", receivedSignature);
    }

    const transaction = await prisma.transaction.findUnique({
      where: { invoice_number: invoiceNumber },
      include: { package: true },
    });

    if (!transaction) {
      console.error(`❌ Transaction not found for invoice: ${invoiceNumber}`);
      return res.status(200).json({ status: "OK" }); // Tetap 200 agar DOKU tidak retry
    }

    console.log(`📊 Transaction status from DOKU: ${transactionStatus} for invoice ${invoiceNumber}`);

    if (transactionStatus === "SUCCESS" || transactionStatus === "PAID") {
      if (transaction.status === "SUCCESS") {
        console.log(`ℹ️ Transaction ${invoiceNumber} already processed as SUCCESS`);
        return res.status(200).json({ status: "OK" });
      }

      // Aktivasi paket setelah pembayaran berhasil
      await prisma.$transaction(async (tx) => {
        // Update status transaksi
        await tx.transaction.update({
          where: { id: transaction.id },
          data: {
            status: "SUCCESS",
            reference_id: body?.transaction?.reference_id || body?.order?.order_id,
            payment_method: body?.payment?.payment_channel || body?.payment?.payment_method || transaction.payment_method || "DOKU",
          },
        });

        // Aktivasi package untuk user
        const pkg = transaction.package;
        const userId = transaction.user_id;

        await tx.userPackageBalance.upsert({
          where: {
            user_id_package_id: {
              user_id: userId,
              package_id: pkg.id,
            },
          },
          update: {
            coins_purchased: { increment: pkg.jumlahKoin },
            coins_remaining: { increment: pkg.jumlahKoin },
          },
          create: {
            user_id: userId,
            package_id: pkg.id,
            coins_purchased: pkg.jumlahKoin,
            coins_remaining: pkg.jumlahKoin,
          },
        });

        const allBalances = await tx.userPackageBalance.findMany({
          where: { user_id: userId },
          select: { coins_remaining: true },
        });

        const totalCoins = allBalances.reduce(
          (sum, b) => sum + b.coins_remaining,
          0,
        );

        await tx.user.update({
          where: { id: userId },
          data: {
            sisa_credit: totalCoins,
            active_package_id: pkg.id,
            status_langganan: true,
            tipe_akun: "premium",
          },
        });
      });

      console.log(`✅ Payment SUCCESS - Package activated for user ${transaction.user_id}, invoice ${invoiceNumber}`);
    } else if (transactionStatus === "FAILED" || transactionStatus === "EXPIRED") {
      await prisma.transaction.update({
        where: { id: transaction.id },
        data: { status: transactionStatus === "EXPIRED" ? "FAILED" : "FAILED" },
      });
      console.log(`❌ Payment ${transactionStatus} for invoice ${invoiceNumber}`);
    } else {
      console.log(`⏳ Payment status ${transactionStatus} for invoice ${invoiceNumber} - keeping PENDING`);
    }

    // DOKU mengharapkan response 200 OK
    return res.status(200).json({ status: "OK" });
  } catch (error) {
    console.error("Payment Notification Error:", error);
    // Tetap return 200 agar DOKU tidak retry terus
    return res.status(200).json({ status: "OK" });
  }
};

/**
 * POST /payments/callback
 * Callback lama (dari redirect DOKU) - tetap ada untuk kompatibilitas
 */
exports.paymentCallback = async (req, res) => {
  try {
    const { order_id, invoice_number, status, reference_id } = req.body;

    const transaction = await prisma.transaction.findUnique({
      where: { invoice_number },
      include: { user: true, package: true },
    });

    if (!transaction) {
      console.error("Transaction not found for invoice:", invoice_number);
      return sendError(res, {
        message: "Transaksi tidak ditemukan",
        statusCode: 404,
      });
    }

    if (status === "SUCCESS" || status === "PAID") {
      if (transaction.status === "SUCCESS") {
        return success(res, { message: "Pembayaran sudah diproses sebelumnya" });
      }

      const result = await prisma.$transaction(async (tx) => {
        await tx.transaction.update({
          where: { id: transaction.id },
          data: {
            status: "SUCCESS",
            reference_id: reference_id,
            payment_method: req.body.payment_channel || req.body.payment_method || transaction.payment_method || "DOKU",
          },
        });

        const pkg = transaction.package;
        const userId = transaction.user_id;

        await tx.userPackageBalance.upsert({
          where: {
            user_id_package_id: {
              user_id: userId,
              package_id: pkg.id,
            },
          },
          update: {
            coins_purchased: { increment: pkg.jumlahKoin },
            coins_remaining: { increment: pkg.jumlahKoin },
          },
          create: {
            user_id: userId,
            package_id: pkg.id,
            coins_purchased: pkg.jumlahKoin,
            coins_remaining: pkg.jumlahKoin,
          },
        });

        const allBalances = await tx.userPackageBalance.findMany({
          where: { user_id: userId },
          select: { coins_remaining: true },
        });

        const totalCoins = allBalances.reduce(
          (sum, b) => sum + b.coins_remaining,
          0,
        );

        const updatedUser = await tx.user.update({
          where: { id: userId },
          data: {
            sisa_credit: totalCoins,
            active_package_id: pkg.id,
            status_langganan: true,
            tipe_akun: "premium",
          },
          include: { active_package: true },
        });

        return updatedUser;
      });

      return success(res, {
        message: "Pembayaran berhasil, paket telah diaktifkan",
        data: {
          sisa_credit: result.sisa_credit,
          active_package: result.active_package?.namaPaket,
        },
      });
    } else if (status === "FAILED") {
      await prisma.transaction.update({
        where: { id: transaction.id },
        data: { status: "FAILED" },
      });

      return sendError(res, {
        message: "Pembayaran gagal",
        statusCode: 400,
      });
    } else {
      return success(res, {
        message: "Status pembayaran masih tertunda",
      });
    }
  } catch (error) {
    console.error("Payment Callback Error:", error);
    return sendError(res, {
      message: "Error memproses callback pembayaran",
      statusCode: 500,
    });
  }
};
