CREATE TABLE `email_log` (
	`id` varchar(36) NOT NULL,
	`company_id` varchar(36) NOT NULL,
	`sent_by` varchar(36),
	`document_type` enum('estimate','invoice') NOT NULL,
	`document_id` varchar(36) NOT NULL,
	`to_email` varchar(254) NOT NULL,
	`provider_id` varchar(100),
	`created_at` datetime(3) NOT NULL,
	CONSTRAINT `email_log_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `company_settings` ADD `taxable_categories` json;--> statement-breakpoint
ALTER TABLE `company_settings` ADD `deposit_percent` decimal(7,3) DEFAULT 50 NOT NULL;--> statement-breakpoint
ALTER TABLE `estimates` ADD `sections` json;--> statement-breakpoint
ALTER TABLE `estimates` ADD `taxable_categories` json;--> statement-breakpoint
ALTER TABLE `invoices` ADD `kind` enum('final','deposit') DEFAULT 'final' NOT NULL;--> statement-breakpoint
ALTER TABLE `invoices` ADD `sections` json;--> statement-breakpoint
ALTER TABLE `invoices` ADD `taxable_categories` json;--> statement-breakpoint
ALTER TABLE `invoices` ADD `deposit_applied` decimal(12,2) DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `invoices` ADD CONSTRAINT `invoice_estimate_kind_uq` UNIQUE(`estimate_id`,`kind`);--> statement-breakpoint
ALTER TABLE `invoices` DROP INDEX `invoices_estimate_id_unique`;--> statement-breakpoint
ALTER TABLE `email_log` ADD CONSTRAINT `email_log_company_id_companies_id_fk` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `email_log` ADD CONSTRAINT `email_log_sent_by_user_id_fk` FOREIGN KEY (`sent_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `email_log_company_idx` ON `email_log` (`company_id`,`created_at`);