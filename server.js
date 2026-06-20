require("dotenv").config();
const app = require("./src/app");

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(
    `✅ Backend Key Barber berhasil berjalan di http://localhost:${PORT}`,
  );
  console.log(
    `📁 Akses dokumentasi API di http://localhost:${PORT}/api-docs`,
  );
  console.log(
    `📁 Akses gambar lokal aktif di http://localhost:${PORT}/uploads`,
  );
});

// Database server started
