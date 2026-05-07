const { PrismaClient } = require("@prisma/client");
const axios = require("axios");
const prisma = new PrismaClient();

exports.reportSystemError = async (
  source,
  errorDetail,
  severity = "CRITICAL",
) => {
  try {
    await prisma.notification.create({
      data: {
        type: "SYSTEM_ERROR",
        title: `🚨 ${severity}: Failure in ${source}`,
        message: `Terjadi kegagalan fatal pada ${source}. Detail: ${errorDetail}`,
        is_read: false,
        source: source,
      },
    });

    if (process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_ADMIN_CHAT_ID) {
      const htmlMessage = `
<b>🚨 SYSTEM ALERT: KEY BARBER</b>

<b>Severity:</b> ${severity}
<b>Source:</b> ${source}
<b>Time:</b> ${new Date().toLocaleString("id-ID")}

<b>Detail Error:</b>
<code>${errorDetail.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</code>

<i>Tindakan diperlukan segera!</i>
      `;

      await axios.post(
        `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`,
        {
          chat_id: process.env.TELEGRAM_ADMIN_CHAT_ID,
          text: htmlMessage,
          parse_mode: "HTML",
        },
      );
    }
  } catch (err) {
    console.error(
      "Telegram Alert Failed:",
      err.response ? err.response.data : err.message,
    );
  }
};
