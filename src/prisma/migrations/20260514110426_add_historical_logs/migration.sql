-- AlterTable
ALTER TABLE `aimodel` ADD COLUMN `hargaPerImage` DOUBLE NOT NULL DEFAULT 0,
    ADD COLUMN `pricingUnit` VARCHAR(191) NOT NULL DEFAULT 'TOKEN',
    MODIFY `hargaInput1M` DOUBLE NOT NULL DEFAULT 0,
    MODIFY `hargaOutput1M` DOUBLE NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE `subscriptionpackage` ADD COLUMN `featBarberInstructions` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `featFaceHeatmap` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `featHairAnalysis` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `featRiskAnalysis` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `featTrendAnalysis` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `hppBreakdown` JSON NULL,
    ADD COLUMN `imageModelId` VARCHAR(191) NULL,
    ADD COLUMN `llmModelId` VARCHAR(191) NULL,
    ADD COLUMN `virtualTryOnLimit` INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE `systemapilog` ADD COLUMN `charge_usd` DECIMAL(10, 6) NOT NULL DEFAULT 0,
    ADD COLUMN `features_used` TEXT NULL,
    ADD COLUMN `koin_charged` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `membership_snapshot` VARCHAR(191) NULL,
    ADD COLUMN `service_fee_koin` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `token_fee_koin` INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE `user` ADD COLUMN `active_package_id` VARCHAR(191) NULL,
    ADD COLUMN `agreed_at` DATETIME(3) NULL,
    ADD COLUMN `agreed_to_terms` BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE `audit_logs` (
    `id` VARCHAR(191) NOT NULL,
    `admin_id` VARCHAR(191) NOT NULL,
    `action` VARCHAR(191) NOT NULL,
    `target` VARCHAR(191) NULL,
    `details` JSON NULL,
    `ip_address` VARCHAR(191) NULL,
    `userAgent` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SocialMedia` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `title` VARCHAR(191) NOT NULL,
    `link` VARCHAR(191) NOT NULL,
    `thumbnail` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `waitlist` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NULL,
    `email` VARCHAR(191) NULL,
    `phone` VARCHAR(191) NULL,
    `pesan` TEXT NOT NULL,
    `is_handled` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `User` ADD CONSTRAINT `User_active_package_id_fkey` FOREIGN KEY (`active_package_id`) REFERENCES `SubscriptionPackage`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `audit_logs` ADD CONSTRAINT `audit_logs_admin_id_fkey` FOREIGN KEY (`admin_id`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SubscriptionPackage` ADD CONSTRAINT `SubscriptionPackage_llmModelId_fkey` FOREIGN KEY (`llmModelId`) REFERENCES `AiModel`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SubscriptionPackage` ADD CONSTRAINT `SubscriptionPackage_imageModelId_fkey` FOREIGN KEY (`imageModelId`) REFERENCES `AiModel`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
