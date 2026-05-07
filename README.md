# Key Barber Backend: AI-Powered Morphology Analytics

[![Node.js](https://img.shields.io/badge/Node.js-v20+-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![Prisma](https://img.shields.io/badge/ORM-Prisma-2D3748?logo=prisma&logoColor=white)](https://www.prisma.io/)
[![MySQL](https://img.shields.io/badge/Database-MySQL-4479A1?logo=mysql&logoColor=white)](https://www.mysql.com/)
[![Swagger](https://img.shields.io/badge/API_Docs-Swagger-85EA2D?logo=swagger&logoColor=black)](/api-docs)

**Key Barber Backend** adalah *core engine* berbasis AI yang dirancang untuk merevolusi industri pangkas rambut melalui analisis morfologi wajah. Sistem ini mengintegrasikan teknologi Large Language Models (LLM) untuk memberikan rekomendasi gaya rambut yang presisi berdasarkan struktur anatomi wajah pengguna.

---

## System Design & Engineering Excellence

Proyek ini dibangun dengan mengimplementasikan standar arsitektur **Enterprise-Grade** untuk menjamin skalabilitas dan ketersediaan tinggi:

### 1. Multi-Channel Failover System (Resilience)
Sistem pengiriman OTP dirancang dengan arsitektur **Primary-Fallback** guna menjamin *uptime* layanan:
* **Primary Path**: SMTP Gmail (App Password Integration).
* **Secondary Path**: Brevo API (Otomatis beralih jika jalur utama mengalami gangguan atau limit).
* **Background Processing**: Menggunakan pola *Asynchronous Fire-and-Forget* guna memastikan *Response Time* API tetap di bawah **50ms** tanpa terhambat proses pengiriman email.

### 2. Proactive Observability (Real-time Monitoring)
Menerapkan sistem monitoring mandiri menggunakan integrasi **Telegram Bot Alerting**:
* Setiap kegagalan fatal pada *background process* (Email/AI) akan dilaporkan secara instan ke kanal Telegram Admin melalui `alert.service.js`.
* Mencakup pencatatan otomatis ke tabel `notifications` di database untuk kebutuhan audit dan analisis riwayat sistem.

### 3. AI Cost Management & Token Optimization
Manajemen sumber daya API yang efisien untuk menjaga profitabilitas operasional:
* **Dynamic Estimation**: Sistem menghitung estimasi token dan biaya (USD) sebelum memproses permintaan AI.
* **Smart Credit Validation**: Validasi saldo koin pengguna secara *real-time* untuk mencegah pemanggilan API yang tidak perlu dan melindungi saldo API provider.

---

## Technology Stack

| Layer | Technology |
| :--- | :--- |
| **Runtime Environment** | Node.js (Express.js) |
| **Database ORM** | Prisma ORM |
| **Primary Database** | MySQL |
| **Security** | JWT, Bcrypt, Helmet, CORS |
| **AI Processing** | Google Generative AI |
| **Observability** | Telegram API & Winston Logging |
| **Documentation** | OpenAPI 3.0 (Swagger) |

---

## Project Structure

Mengikuti prinsip **Separation of Concerns (SoC)** dan **Clean Architecture**:

```text
src/
 ├── config/      # Konfigurasi Swagger & Koneksi Database
 ├── controllers/ # Logika orkestrasi request & response
 ├── middleware/  # Proteksi Auth (RBAC), Validasi, & Error Handling
 ├── routes/      # Definisi endpoint API yang terstruktur
 ├── services/    # Bisnis Logika Inti (AI, Mail Failover, Telegram Alerting)
 ├── utils/       # Utility (Enkripsi, Memory Cache, File Upload)
 └── validations/ # Skema validasi data menggunakan Zod
