ALTER TABLE `schedule_blocks` ADD `assigned_user_id` varchar(36);--> statement-breakpoint
ALTER TABLE `schedule_blocks` ADD CONSTRAINT `schedule_blocks_assigned_user_id_user_id_fk` FOREIGN KEY (`assigned_user_id`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `block_assignee_idx` ON `schedule_blocks` (`assigned_user_id`);