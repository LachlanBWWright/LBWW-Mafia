CREATE TABLE "nextjs_lobby_invitation" (
	"id" serial PRIMARY KEY NOT NULL,
	"sender_id" varchar(255) NOT NULL,
	"recipient_id" varchar(255) NOT NULL,
	"room_id" varchar(64) NOT NULL,
	"status" varchar(16) DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "nextjs_lobby_preset" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"name" varchar(60) NOT NULL,
	"config" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "nextjs_mobile_oauth_request" (
	"id" varchar(128) PRIMARY KEY NOT NULL,
	"challenge" varchar(128) NOT NULL,
	"browser_hash" varchar(64),
	"code_hash" varchar(64),
	"user_id" varchar(255),
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "nextjs_notification" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"actor_id" varchar(255),
	"category" varchar(24) NOT NULL,
	"room_id" varchar(64),
	"invitation_id" integer,
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "nextjs_player_report" (
	"id" serial PRIMARY KEY NOT NULL,
	"reporter_id" varchar(255) NOT NULL,
	"subject_id" varchar(255) NOT NULL,
	"reason" varchar(32) NOT NULL,
	"details" text NOT NULL,
	"match_id" integer,
	"message_id" integer,
	"status" varchar(16) DEFAULT 'pending' NOT NULL,
	"resolution" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "nextjs_user" ADD COLUMN "message_permission" varchar(16) DEFAULT 'friends' NOT NULL;--> statement-breakpoint
ALTER TABLE "nextjs_user" ADD COLUMN "invite_permission" varchar(16) DEFAULT 'friends' NOT NULL;--> statement-breakpoint
ALTER TABLE "nextjs_user" ADD COLUMN "hide_presence" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "nextjs_user" ADD COLUMN "avatar_preset" varchar(24);--> statement-breakpoint
ALTER TABLE "nextjs_user" ADD COLUMN "notification_friend_requests" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "nextjs_user" ADD COLUMN "notification_messages" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "nextjs_user" ADD COLUMN "notification_invites" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "nextjs_lobby_invitation" ADD CONSTRAINT "nextjs_lobby_invitation_sender_id_nextjs_user_id_fk" FOREIGN KEY ("sender_id") REFERENCES "public"."nextjs_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nextjs_lobby_invitation" ADD CONSTRAINT "nextjs_lobby_invitation_recipient_id_nextjs_user_id_fk" FOREIGN KEY ("recipient_id") REFERENCES "public"."nextjs_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nextjs_lobby_preset" ADD CONSTRAINT "nextjs_lobby_preset_user_id_nextjs_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."nextjs_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nextjs_mobile_oauth_request" ADD CONSTRAINT "nextjs_mobile_oauth_request_user_id_nextjs_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."nextjs_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nextjs_notification" ADD CONSTRAINT "nextjs_notification_user_id_nextjs_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."nextjs_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nextjs_notification" ADD CONSTRAINT "nextjs_notification_actor_id_nextjs_user_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."nextjs_user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nextjs_player_report" ADD CONSTRAINT "nextjs_player_report_reporter_id_nextjs_user_id_fk" FOREIGN KEY ("reporter_id") REFERENCES "public"."nextjs_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nextjs_player_report" ADD CONSTRAINT "nextjs_player_report_subject_id_nextjs_user_id_fk" FOREIGN KEY ("subject_id") REFERENCES "public"."nextjs_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nextjs_player_report" ADD CONSTRAINT "nextjs_player_report_match_id_nextjs_match_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."nextjs_match"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nextjs_player_report" ADD CONSTRAINT "nextjs_player_report_message_id_nextjs_direct_message_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."nextjs_direct_message"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "invitation_recipient_idx" ON "nextjs_lobby_invitation" USING btree ("recipient_id");--> statement-breakpoint
CREATE INDEX "preset_user_idx" ON "nextjs_lobby_preset" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "notification_user_created_idx" ON "nextjs_notification" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "report_reporter_idx" ON "nextjs_player_report" USING btree ("reporter_id");--> statement-breakpoint
CREATE INDEX "report_status_idx" ON "nextjs_player_report" USING btree ("status");--> statement-breakpoint
-- Google-only authentication invalidates credentials-issued sessions.
UPDATE "nextjs_user" SET "auth_version" = "auth_version" + 1;
--> statement-breakpoint
UPDATE "nextjs_mobile_session" SET "revoked_at" = now() WHERE "revoked_at" IS NULL;
