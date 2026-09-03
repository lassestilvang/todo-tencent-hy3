CREATE TABLE `webhooks` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`url` text NOT NULL,
	`events` text NOT NULL,
	`secret` text NOT NULL,
	`active` integer NOT NULL DEFAULT true,
	`retry_count` integer NOT NULL DEFAULT 0,
	`max_retries` integer NOT NULL DEFAULT 3,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`last_triggered` integer,
	`last_error` text
);
--> statement-breakpoint
CREATE INDEX `webhooks_active_idx` ON `webhooks` (`active`);--> statement-breakpoint
CREATE TABLE `share_links` (
	`id` text PRIMARY KEY NOT NULL,
	`token` text NOT NULL,
	`list_id` text NOT NULL,
	`permission` text NOT NULL,
	`expires_at` integer,
	`password_hash` text,
	`created_at` integer NOT NULL,
	`created_by` text NOT NULL,
	`access_count` integer NOT NULL DEFAULT 0,
	`last_accessed` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `share_links_token_idx` ON `share_links` (`token`);--> statement-breakpoint
CREATE INDEX `share_links_list_id_idx` ON `share_links` (`list_id`);--> statement-breakpoint
CREATE TABLE `workspaces` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`owner_id` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`settings` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `workspace_members` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`user_id` text NOT NULL,
	`email` text NOT NULL,
	`name` text NOT NULL,
	`role` text NOT NULL,
	`joined_at` integer NOT NULL,
	`avatar_url` text
);
--> statement-breakpoint
CREATE INDEX `workspace_members_workspace_idx` ON `workspace_members` (`workspace_id`);--> statement-breakpoint
CREATE INDEX `workspace_members_user_idx` ON `workspace_members` (`user_id`);--> statement-breakpoint
CREATE TABLE `workspace_invitations` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`email` text NOT NULL,
	`role` text NOT NULL,
	`invited_by` text NOT NULL,
	`invited_by_name` text NOT NULL,
	`status` text NOT NULL DEFAULT 'pending',
	`token` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	`accepted_at` integer
);
--> statement-breakpoint
CREATE INDEX `workspace_invitations_workspace_idx` ON `workspace_invitations` (`workspace_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `workspace_invitations_token_idx` ON `workspace_invitations` (`token`);--> statement-breakpoint
CREATE TABLE `workspace_activity` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`user_id` text NOT NULL,
	`user_name` text NOT NULL,
	`action` text NOT NULL,
	`details` text NOT NULL,
	`entity_type` text NOT NULL,
	`entity_id` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `workspace_activity_workspace_idx` ON `workspace_activity` (`workspace_id`);--> statement-breakpoint
CREATE INDEX `workspace_activity_created_at_idx` ON `workspace_activity` (`created_at`);--> statement-breakpoint
CREATE TABLE `task_comments` (
	`id` text PRIMARY KEY NOT NULL,
	`task_id` text NOT NULL,
	`workspace_id` text NOT NULL,
	`user_id` text NOT NULL,
	`user_name` text NOT NULL,
	`user_avatar` text,
	`content` text NOT NULL,
	`mentions` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer
);
--> statement-breakpoint
CREATE INDEX `task_comments_task_idx` ON `task_comments` (`task_id`);--> statement-breakpoint
CREATE INDEX `task_comments_workspace_idx` ON `task_comments` (`workspace_id`);
