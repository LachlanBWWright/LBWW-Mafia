CREATE TABLE "nextjs_mobile_session" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"refresh_hash" varchar(64) NOT NULL,
	"auth_version" integer NOT NULL,
	"device_name" varchar(80) DEFAULT 'Mobile device' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	CONSTRAINT "nextjs_mobile_session_refresh_hash_unique" UNIQUE("refresh_hash")
);
--> statement-breakpoint
CREATE TABLE "nextjs_request_limit" (
	"key" varchar(64) PRIMARY KEY NOT NULL,
	"window_start" timestamp with time zone NOT NULL,
	"hits" integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE "nextjs_direct_message" ADD COLUMN "command_id" varchar(128);--> statement-breakpoint
ALTER TABLE "nextjs_match" ADD COLUMN "game_id" varchar(128);--> statement-breakpoint
ALTER TABLE "nextjs_user" ADD COLUMN "auth_version" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "nextjs_mobile_session" ADD CONSTRAINT "nextjs_mobile_session_user_id_nextjs_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."nextjs_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "mobile_session_user_idx" ON "nextjs_mobile_session" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "direct_message_command_idx" ON "nextjs_direct_message" USING btree ("sender_id","command_id");--> statement-breakpoint
ALTER TABLE "nextjs_match" ADD CONSTRAINT "nextjs_match_game_id_unique" UNIQUE("game_id");--> statement-breakpoint
ALTER TABLE "nextjs_user" ADD CONSTRAINT "nextjs_user_email_unique" UNIQUE("email");