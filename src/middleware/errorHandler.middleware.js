// src/middleware/errorHandler.middleware.js
export const errorHandler = (err, req, res, next) => {
  // Jika kamu sudah pasang pino, gunakan req.log.error(err)
  console.error(err);

  const statusCode = err.statusCode || 500;
  const message = err.message || "Internal Server Error";

  res.status(statusCode).json({
    status: "error",
    statusCode,
    message,
    // Stack trace hanya muncul saat tahap development
    ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
  });
};
