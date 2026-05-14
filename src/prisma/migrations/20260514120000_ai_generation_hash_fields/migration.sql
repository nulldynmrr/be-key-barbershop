-- Dedupe & audit trail: same user + same image bytes + same feature set
ALTER TABLE `AIGeneration` ADD COLUMN `image_hash` VARCHAR(64) NULL;
ALTER TABLE `AIGeneration` ADD COLUMN `feature_fingerprint` VARCHAR(64) NULL;
CREATE INDEX `AIGeneration_user_id_image_hash_feature_fingerprint_idx` ON `AIGeneration`(`user_id`, `image_hash`, `feature_fingerprint`);
