CREATE TABLE `monitoring_records` (
	`workspace_id` text NOT NULL,
	`kind` text NOT NULL,
	`id` text NOT NULL,
	`patient_id` text DEFAULT '' NOT NULL,
	`payload` text NOT NULL,
	`at` integer NOT NULL,
	PRIMARY KEY(`workspace_id`, `kind`, `id`),
	FOREIGN KEY (`workspace_id`) REFERENCES `monitoring_workspaces`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `monitoring_record_time` ON `monitoring_records` (`workspace_id`,`kind`,`at`);--> statement-breakpoint
CREATE TABLE `monitoring_workspaces` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`source` text NOT NULL,
	`version` integer DEFAULT 0 NOT NULL,
	`write_token` text DEFAULT '' NOT NULL,
	`payload` text NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `telemetry_keys` (
	`owner_id` text PRIMARY KEY NOT NULL,
	`hash` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `telemetry_keys_hash_unique` ON `telemetry_keys` (`hash`);