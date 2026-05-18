const { error } = require("../utils/response.helper");

const errorHandler = (err, req, res, next) => {
  // Log the error using pino (if attached) or console
  const log = req.log || console;
  log.error({ 
    err: {
      message: err.message,
      stack: process.env.NODE_ENV !== "production" ? err.stack : undefined,
      name: err.name
    },
    requestId: req.id
  }, `[Error] ${err.name}: ${err.message}`);

  const statusCode = err.statusCode || 500;
  const message = err.message || "Internal Server Error";
  const errorCode = err.errorCode || "INTERNAL_ERROR";

  return error(res, {
    statusCode,
    errorCode,
    message,
    errors: err.errors || (process.env.NODE_ENV !== "production" ? [err.stack] : undefined),
  });
};

module.exports = { errorHandler };
