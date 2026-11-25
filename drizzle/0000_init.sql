CREATE TABLE `account` (
	`id` varchar(36) NOT NULL,
	`account_id` varchar(255) NOT NULL,
	`provider_id` varchar(64) NOT NULL,
	`user_id` varchar(36) NOT NULL,
	`access_token` text,
	`refresh_token` text,
	`id_token` text,
	`access_token_expires_at` datetime(3),
	`refresh_token_expires_at` datetime(3),
	`scope` text,
	`password` text,
	`created_at` datetime(3) NOT NULL,
	`updated_at` datetime(3) NOT NULL,
	CONSTRAINT `account_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `ai_usage` (
	`company_id` varchar(36) NOT NULL,
	`day` date NOT NULL,
	`count` int NOT NULL DEFAULT 0,
	CONSTRAINT `ai_usage_company_id_day_pk` PRIMARY KEY(`company_id`,`day`)
);
--> statement-breakpoint
CREATE TABLE `companies` (
	`id` varchar(36) NOT NULL,
	`name` varchar(160) NOT NULL,
	`created_at` datetime(3) NOT NULL,
	CONSTRAINT `companies_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `company_settings` (
	`company_id` varchar(36) NOT NULL,
	`email` varchar(254) NOT NULL DEFAULT '',
	`phone` varchar(40) NOT NULL DEFAULT '',
	`address` varchar(255) NOT NULL DEFAULT '',
	`license_number` varchar(80) NOT NULL DEFAULT '',
	`default_markup` decimal(7,3) NOT NULL DEFAULT 20,
	`default_tax` decimal(7,3) NOT NULL DEFAULT 6,
	`terms` text NOT NULL,
	`estimate_counter` int NOT NULL DEFAULT 1000,
	`invoice_counter` int NOT NULL DEFAULT 2000,
	`updated_at` datetime(3) NOT NULL,
	CONSTRAINT `company_settings_company_id` PRIMARY KEY(`company_id`)
);
--> statement-breakpoint
CREATE TABLE `customers` (
	`id` varchar(36) NOT NULL,
	`company_id` varchar(36) NOT NULL,
	`name` varchar(160) NOT NULL,
	`email` varchar(254) NOT NULL DEFAULT '',
	`phone` varchar(40) NOT NULL DEFAULT '',
	`address` varchar(255) NOT NULL DEFAULT '',
	`notes` text NOT NULL,
	`created_at` datetime(3) NOT NULL,
	`updated_at` datetime(3) NOT NULL,
	CONSTRAINT `customers_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `estimates` (
	`id` varchar(36) NOT NULL,
	`company_id` varchar(36) NOT NULL,
	`number` varchar(32) NOT NULL,
	`customer_id` varchar(36),
	`job_title` varchar(200) NOT NULL,
	`job_address` varchar(255) NOT NULL DEFAULT '',
	`trade` enum('general','carpentry','electrical','plumbing','hvac','roofing','painting','concrete') NOT NULL,
	`status` enum('draft','sent','accepted','declined','converted') NOT NULL,
	`line_items` json NOT NULL,
	`tax_percent` decimal(7,3) NOT NULL,
	`notes` text NOT NULL,
	`valid_until` date NOT NULL,
	`created_at` datetime(3) NOT NULL,
	`updated_at` datetime(3) NOT NULL,
	CONSTRAINT `estimates_id` PRIMARY KEY(`id`),
	CONSTRAINT `estimate_company_number_uq` UNIQUE(`company_id`,`number`)
);
--> statement-breakpoint
CREATE TABLE `invites` (
	`id` varchar(36) NOT NULL,
	`company_id` varchar(36) NOT NULL,
	`email` varchar(254) NOT NULL,
	`role` enum('owner','member') NOT NULL,
	`token_hash` varchar(64) NOT NULL,
	`created_by` varchar(36),
	`created_at` datetime(3) NOT NULL,
	`expires_at` datetime(3) NOT NULL,
	`accepted_at` datetime(3),
	CONSTRAINT `invites_id` PRIMARY KEY(`id`),
	CONSTRAINT `invites_token_hash_unique` UNIQUE(`token_hash`)
);
--> statement-breakpoint
CREATE TABLE `invoices` (
	`id` varchar(36) NOT NULL,
	`company_id` varchar(36) NOT NULL,
	`number` varchar(32) NOT NULL,
	`estimate_id` varchar(36),
	`customer_id` varchar(36),
	`job_title` varchar(200) NOT NULL,
	`job_address` varchar(255) NOT NULL DEFAULT '',
	`status` enum('draft','sent','paid','overdue') NOT NULL,
	`line_items` json NOT NULL,
	`tax_percent` decimal(7,3) NOT NULL,
	`notes` text NOT NULL,
	`due_date` date NOT NULL,
	`paid_at` datetime(3),
	`created_at` datetime(3) NOT NULL,
	`updated_at` datetime(3) NOT NULL,
	CONSTRAINT `invoices_id` PRIMARY KEY(`id`),
	CONSTRAINT `invoices_estimate_id_unique` UNIQUE(`estimate_id`),
	CONSTRAINT `invoice_company_number_uq` UNIQUE(`company_id`,`number`)
);
--> statement-breakpoint
CREATE TABLE `memberships` (
	`company_id` varchar(36) NOT NULL,
	`user_id` varchar(36) NOT NULL,
	`role` enum('owner','member') NOT NULL,
	`created_at` datetime(3) NOT NULL,
	CONSTRAINT `memberships_company_id_user_id_pk` PRIMARY KEY(`company_id`,`user_id`)
);
--> statement-breakpoint
CREATE TABLE `pricebook_items` (
	`id` varchar(36) NOT NULL,
	`company_id` varchar(36) NOT NULL,
	`name` varchar(160) NOT NULL,
	`category` enum('labor','material','equipment','other') NOT NULL,
	`trade` enum('general','carpentry','electrical','plumbing','hvac','roofing','painting','concrete') NOT NULL,
	`unit` varchar(16) NOT NULL,
	`unit_cost` decimal(12,4) NOT NULL,
	`keywords` json NOT NULL,
	`created_at` datetime(3) NOT NULL,
	`updated_at` datetime(3) NOT NULL,
	CONSTRAINT `pricebook_items_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `schedule_blocks` (
	`id` varchar(36) NOT NULL,
	`company_id` varchar(36) NOT NULL,
	`estimate_id` varchar(36) NOT NULL,
	`line_item_ids` json,
	`title` varchar(255) NOT NULL,
	`start` datetime(3) NOT NULL,
	`duration_minutes` int NOT NULL,
	`created_at` datetime(3) NOT NULL,
	`updated_at` datetime(3) NOT NULL,
	CONSTRAINT `schedule_blocks_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `session` (
	`id` varchar(36) NOT NULL,
	`expires_at` datetime(3) NOT NULL,
	`token` varchar(255) NOT NULL,
	`created_at` datetime(3) NOT NULL,
	`updated_at` datetime(3) NOT NULL,
	`ip_address` varchar(64),
	`user_agent` text,
	`user_id` varchar(36) NOT NULL,
	CONSTRAINT `session_id` PRIMARY KEY(`id`),
	CONSTRAINT `session_token_unique` UNIQUE(`token`)
);
--> statement-breakpoint
CREATE TABLE `user` (
	`id` varchar(36) NOT NULL,
	`name` varchar(120) NOT NULL,
	`email` varchar(254) NOT NULL,
	`email_verified` boolean NOT NULL DEFAULT false,
	`image` text,
	`created_at` datetime(3) NOT NULL,
	`updated_at` datetime(3) NOT NULL,
	CONSTRAINT `user_id` PRIMARY KEY(`id`),
	CONSTRAINT `user_email_unique` UNIQUE(`email`)
);
--> statement-breakpoint
CREATE TABLE `verification` (
	`id` varchar(36) NOT NULL,
	`identifier` varchar(255) NOT NULL,
	`value` text NOT NULL,
	`expires_at` datetime(3) NOT NULL,
	`created_at` datetime(3) NOT NULL,
	`updated_at` datetime(3) NOT NULL,
	CONSTRAINT `verification_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `account` ADD CONSTRAINT `account_user_id_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `ai_usage` ADD CONSTRAINT `ai_usage_company_id_companies_id_fk` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `company_settings` ADD CONSTRAINT `company_settings_company_id_companies_id_fk` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `customers` ADD CONSTRAINT `customers_company_id_companies_id_fk` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `estimates` ADD CONSTRAINT `estimates_company_id_companies_id_fk` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `estimates` ADD CONSTRAINT `estimates_customer_id_customers_id_fk` FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `invites` ADD CONSTRAINT `invites_company_id_companies_id_fk` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `invites` ADD CONSTRAINT `invites_created_by_user_id_fk` FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `invoices` ADD CONSTRAINT `invoices_company_id_companies_id_fk` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `invoices` ADD CONSTRAINT `invoices_estimate_id_estimates_id_fk` FOREIGN KEY (`estimate_id`) REFERENCES `estimates`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `invoices` ADD CONSTRAINT `invoices_customer_id_customers_id_fk` FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `memberships` ADD CONSTRAINT `memberships_company_id_companies_id_fk` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `memberships` ADD CONSTRAINT `memberships_user_id_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `pricebook_items` ADD CONSTRAINT `pricebook_items_company_id_companies_id_fk` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `schedule_blocks` ADD CONSTRAINT `schedule_blocks_company_id_companies_id_fk` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `schedule_blocks` ADD CONSTRAINT `schedule_blocks_estimate_id_estimates_id_fk` FOREIGN KEY (`estimate_id`) REFERENCES `estimates`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `session` ADD CONSTRAINT `session_user_id_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `account_user_idx` ON `account` (`user_id`);--> statement-breakpoint
CREATE INDEX `customer_company_idx` ON `customers` (`company_id`);--> statement-breakpoint
CREATE INDEX `estimate_company_idx` ON `estimates` (`company_id`,`updated_at`);--> statement-breakpoint
CREATE INDEX `invite_company_idx` ON `invites` (`company_id`);--> statement-breakpoint
CREATE INDEX `invoice_company_idx` ON `invoices` (`company_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `membership_user_idx` ON `memberships` (`user_id`);--> statement-breakpoint
CREATE INDEX `pricebook_company_idx` ON `pricebook_items` (`company_id`);--> statement-breakpoint
CREATE INDEX `block_company_start_idx` ON `schedule_blocks` (`company_id`,`start`);--> statement-breakpoint
CREATE INDEX `session_user_idx` ON `session` (`user_id`);--> statement-breakpoint
CREATE INDEX `verification_identifier_idx` ON `verification` (`identifier`);