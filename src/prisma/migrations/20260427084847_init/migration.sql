-- CreateTable
CREATE TABLE `User` (
    `id` VARCHAR(191) NOT NULL,
    `nama` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NULL,
    `password` VARCHAR(191) NULL,
    `role` ENUM('user', 'admin') NOT NULL DEFAULT 'user',
    `tipe_akun` ENUM('free', 'premium', 'vip') NOT NULL DEFAULT 'free',
    `sisa_credit` INTEGER NOT NULL DEFAULT 3,
    `device_cookie` VARCHAR(191) NULL,
    `status_langganan` BOOLEAN NOT NULL DEFAULT false,
    `tgl_berakhir_langganan` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `User_email_key`(`email`),
    UNIQUE INDEX `User_device_cookie_key`(`device_cookie`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Transaction` (
    `id` VARCHAR(191) NOT NULL,
    `user_id` VARCHAR(191) NOT NULL,
    `jenis_transaksi` VARCHAR(191) NOT NULL,
    `nominal` INTEGER NOT NULL,
    `status` VARCHAR(191) NOT NULL,
    `tgl_transaksi` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AIGeneration` (
    `id` VARCHAR(191) NOT NULL,
    `user_id` VARCHAR(191) NOT NULL,
    `url_foto_upload` VARCHAR(191) NOT NULL,
    `url_hasil_img` JSON NULL,
    `hasil_analisis` JSON NOT NULL,
    `harga_credit_terpakai` INTEGER NOT NULL,
    `tgl_generate` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SystemApiLog` (
    `id` VARCHAR(191) NOT NULL,
    `model_name` VARCHAR(191) NOT NULL,
    `input_tokens` INTEGER NOT NULL,
    `output_tokens` INTEGER NOT NULL,
    `total_tokens` INTEGER NOT NULL,
    `cost_usd` DECIMAL(10, 4) NOT NULL,
    `tgl_penggunaan` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Service` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `nama_layanan` VARCHAR(191) NOT NULL,
    `harga` INTEGER NOT NULL,
    `deskripsi` VARCHAR(191) NULL,
    `durasi` INTEGER NULL,
    `image_url` VARCHAR(191) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Barber` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `nama_kapster` VARCHAR(191) NOT NULL,
    `url_foto_upload` VARCHAR(191) NULL,
    `pengalaman` INTEGER NULL,
    `spesialisasi` VARCHAR(191) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Gallery` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `url_foto_gallery` VARCHAR(191) NOT NULL,
    `kategori` VARCHAR(191) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AdminTokenPurchase` (
    `id` VARCHAR(191) NOT NULL,
    `nama_paket` VARCHAR(191) NOT NULL,
    `jumlah_token` INTEGER NOT NULL,
    `kos_total_idr` INTEGER NOT NULL,
    `tgl_pembelian` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AiModelConfig` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `router_name` VARCHAR(191) NOT NULL,
    `base_url` VARCHAR(191) NULL,
    `api_key` VARCHAR(191) NOT NULL,
    `model_name` VARCHAR(191) NOT NULL,
    `tipe_ai` VARCHAR(191) NOT NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `AiModelConfig_tipe_ai_key`(`tipe_ai`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Transaction` ADD CONSTRAINT `Transaction_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AIGeneration` ADD CONSTRAINT `AIGeneration_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
