/*
  Warnings:

  - A unique constraint covering the columns `[invoice_number]` on the table `Transaction` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[reference_id]` on the table `Transaction` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE `aigeneration` ADD COLUMN `features_used` TEXT NULL,
    MODIFY `url_foto_upload` TEXT NOT NULL;

-- AlterTable
ALTER TABLE `aimodel` ADD COLUMN `last_maia_balance` DECIMAL(10, 6) NULL,
    ADD COLUMN `last_sync_at` DATETIME(3) NULL;

-- AlterTable
ALTER TABLE `systemapilog` ADD COLUMN `attempt_count` INTEGER NOT NULL DEFAULT 1,
    ADD COLUMN `success_count` INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE `transaction` ADD COLUMN `invoice_number` VARCHAR(191) NULL,
    ADD COLUMN `package_id` VARCHAR(191) NULL,
    ADD COLUMN `reference_id` VARCHAR(191) NULL;

-- CreateTable
CREATE TABLE `user_package_balances` (
    `id` VARCHAR(191) NOT NULL,
    `user_id` VARCHAR(191) NOT NULL,
    `package_id` VARCHAR(191) NOT NULL,
    `coins_purchased` INTEGER NOT NULL,
    `coins_remaining` INTEGER NOT NULL,
    `purchased_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `user_package_balances_user_id_package_id_key`(`user_id`, `package_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE UNIQUE INDEX `Transaction_invoice_number_key` ON `Transaction`(`invoice_number`);

-- CreateIndex
CREATE UNIQUE INDEX `Transaction_reference_id_key` ON `Transaction`(`reference_id`);

-- AddForeignKey
ALTER TABLE `Transaction` ADD CONSTRAINT `Transaction_package_id_fkey` FOREIGN KEY (`package_id`) REFERENCES `SubscriptionPackage`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `user_package_balances` ADD CONSTRAINT `user_package_balances_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `user_package_balances` ADD CONSTRAINT `user_package_balances_package_id_fkey` FOREIGN KEY (`package_id`) REFERENCES `SubscriptionPackage`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
