-- CreateTable
CREATE TABLE `FeaturePricing` (
    `id` VARCHAR(191) NOT NULL,
    `featureCode` VARCHAR(191) NOT NULL,
    `namaFitur` VARCHAR(191) NOT NULL,
    `koinCost` INTEGER NOT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `FeaturePricing_featureCode_key`(`featureCode`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
