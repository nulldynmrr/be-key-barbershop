const jwt = require("jsonwebtoken");

exports.verifyToken = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(" ")[1];

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Token tidak ditemukan",
      });
    }

    jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
      if (err) {
        return res.status(401).json({
          success: false,
          message: "Token tidak valid atau kadaluarsa",
        });
      }
      req.user = decoded;
      next();
    });
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: "Akses tidak sah",
    });
  }
};

exports.isAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: "Token tidak ditemukan atau tidak valid",
    });
  }
  if (req.user.role !== "admin") {
    return res.status(403).json({
      success: false,
      message: "Akses ditolak. Butuh izin Admin.",
    });
  }
  next();
};
