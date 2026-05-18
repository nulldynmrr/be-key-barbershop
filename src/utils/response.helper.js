/**
 * Response Helper for Global Standardized API Responses
 * Format: { success, data?, errorCode?, message?, errors? }
 */

exports.success = (res, { data, message, statusCode = 200, meta = {} }) => {
  const response = {
    success: true,
    message: message || "Operation successful",
    data,
  };

  if (meta && Object.keys(meta).length > 0) {
    response.meta = meta;
  }

  return res.status(statusCode).json(response);
};

exports.error = (res, { message, errorCode, errors, statusCode = 500 }) => {
  return res.status(statusCode).json({
    success: false,
    errorCode: errorCode || "INTERNAL_SERVER_ERROR",
    message: message || "An unexpected error occurred",
    errors,
  });
};
