/*
  Warnings:

  - You are about to alter the column `cost_usd` on the `systemapilog` table. The data in that column could be lost. The data in that column will be cast from `Decimal(10,4)` to `Decimal(10,6)`.
  - You are about to drop the `aimodelconfig` table. If the table is not empty, all the data it contains will be lost.

*/
-- AlterTable
ALTER TABLE `admintokenpurchase` ADD COLUMN `nominal_usd` DECIMAL(10, 2) NOT NULL DEFAULT 0,
    MODIFY `jumlah_token` INTEGER NULL;

-- AlterTable
ALTER TABLE `systemapilog` ADD COLUMN `ai_generation_id` VARCHAR(191) NULL,
    ADD COLUMN `user_id` VARCHAR(191) NULL,
    MODIFY `cost_usd` DECIMAL(10, 6) NOT NULL;

-- AlterTable
ALTER TABLE `user` ADD COLUMN `is_banned` BOOLEAN NOT NULL DEFAULT false;

-- DropTable
DROP TABLE `aimodelconfig`;

-- CreateTable
CREATE TABLE `AiModel` (
    `id` VARCHAR(191) NOT NULL,
    `namaRouter` VARCHAR(191) NOT NULL,
    `baseUrl` VARCHAR(191) NOT NULL,
    `modelName` VARCHAR(191) NOT NULL,
    `apiKey` VARCHAR(191) NOT NULL,
    `typeAi` VARCHAR(191) NOT NULL,
    `hargaInput1M` DOUBLE NOT NULL,
    `hargaOutput1M` DOUBLE NOT NULL,
    `maxBudget` DOUBLE NOT NULL,
    `rpmLimit` INTEGER NOT NULL,
    `avgTokensPerUse` INTEGER NOT NULL DEFAULT 2000,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Feedback` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `user_id` VARCHAR(191) NOT NULL,
    `subject` VARCHAR(191) NOT NULL,
    `message` TEXT NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'pending',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SystemConfig` (
    `id` INTEGER NOT NULL DEFAULT 1,
    `globalMultiplier` DOUBLE NOT NULL DEFAULT 1.35,
    `baseRateUsdIdr` DOUBLE NOT NULL,
    `inflationBuffer` DOUBLE NOT NULL DEFAULT 0.05,
    `adminFeeFixed` DOUBLE NOT NULL DEFAULT 4500.0,
    `mdrPercentage` DOUBLE NOT NULL DEFAULT 0.007,
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CreditPackage` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `nama_paket` VARCHAR(191) NOT NULL,
    `tipe_paket` ENUM('ONETIME', 'SUBSCRIPTION') NOT NULL DEFAULT 'ONETIME',
    `jumlah_koin` INTEGER NOT NULL DEFAULT 0,
    `durasi_hari` INTEGER NULL,
    `harga_normal` INTEGER NOT NULL,
    `harga_diskon` INTEGER NULL,
    `diskon_mulai` DATETIME(3) NULL,
    `diskon_akhir` DATETIME(3) NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SubscriptionPackage` (
    `id` VARCHAR(191) NOT NULL,
    `namaPaket` VARCHAR(191) NOT NULL,
    `jumlahKoin` INTEGER NOT NULL,
    `deskripsi` VARCHAR(191) NOT NULL,
    `featStandardScan` BOOLEAN NOT NULL DEFAULT true,
    `featSymmetry` BOOLEAN NOT NULL DEFAULT false,
    `featAdvMapping` BOOLEAN NOT NULL DEFAULT false,
    `featVirtualTryOn` BOOLEAN NOT NULL DEFAULT false,
    `featHistory` BOOLEAN NOT NULL DEFAULT false,
    `typeValue` VARCHAR(191) NOT NULL,
    `durationDays` INTEGER NULL,
    `hppIdeal` DOUBLE NOT NULL,
    `hargaNominal` DOUBLE NOT NULL,
    `promoAktif` BOOLEAN NOT NULL DEFAULT false,
    `hargaDiskon` DOUBLE NULL,
    `diskonMulai` DATETIME(3) NULL,
    `diskonAkhir` DATETIME(3) NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'AKTIF',

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `SystemApiLog` ADD CONSTRAINT `SystemApiLog_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SystemApiLog` ADD CONSTRAINT `SystemApiLog_ai_generation_id_fkey` FOREIGN KEY (`ai_generation_id`) REFERENCES `AIGeneration`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Feedback` ADD CONSTRAINT `Feedback_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
