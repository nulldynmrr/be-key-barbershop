// src/middleware/validate.middleware.js
export const validate = (schema) => async (req, res, next) => {
  try {
    // Memaksa request body melewati pengecekan Zod
    await schema.parseAsync(req.body);
    next();
  } catch (error) {
    // Jika tidak lolos (misal: Harga Nominal < HPP Ideal), langsung tolak
    return res.status(400).json({
      status: "fail",
      message: "Validasi input gagal",
      errors: error.errors.map((err) => ({
        field: err.path.join("."),
        message: err.message,
      })),
    });
  }
};
