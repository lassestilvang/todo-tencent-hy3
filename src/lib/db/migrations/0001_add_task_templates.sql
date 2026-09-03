CREATE TABLE `task_templates` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`priority` text,
	`estimate` integer,
	`recurring` text,
	`list_id` text,
	`tags` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `task_templates_name_idx` ON `task_templates` (`name`);--> statement-breakpoint
CREATE INDEX `task_templates_created_at_idx` ON `task_templates` (`created_at`);
