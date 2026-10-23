CREATE TABLE "nextjs_account" (
	"user_id" varchar(255) NOT NULL,
	"type" varchar(255) NOT NULL,
	"provider" varchar(255) NOT NULL,
	"provider_account_id" varchar(255) NOT NULL,
	"refresh_token" text,
	"access_token" text,
	"expires_at" integer,
	"token_type" varchar(255),
	"scope" varchar(255),
	"id_token" text,
	"session_state" varchar(255),
	CONSTRAINT "nextjs_account_provider_provider_account_id_pk" PRIMARY KEY("provider","provider_account_id")
);
--> statement-breakpoint
CREATE TABLE "nextjs_active_room" (
	"id" integer PRIMARY KEY NOT NULL,
	"room_id" varchar(36) NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "nextjs_audit_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"actor_id" varchar(255),
	"subject_id" varchar(255),
	"action" varchar(64) NOT NULL,
	"metadata" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "nextjs_friendship" (
	"requester_id" varchar(255) NOT NULL,
	"addressee_id" varchar(255) NOT NULL,
	"status" varchar(16) DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "nextjs_friendship_requester_id_addressee_id_pk" PRIMARY KEY("requester_id","addressee_id")
);
--> statement-breakpoint
CREATE TABLE "nextjs_match_participant" (
	"id" serial PRIMARY KEY NOT NULL,
	"match_id" integer NOT NULL,
	"user_id" varchar(255),
	"username" varchar(255) NOT NULL,
	"role" varchar(255) NOT NULL,
	"won" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "nextjs_match" (
	"id" serial PRIMARY KEY NOT NULL,
	"room_name" varchar(255) NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"ended_at" timestamp with time zone NOT NULL,
	"winning_faction" varchar(255) NOT NULL,
	"winning_roles" text NOT NULL,
	"player_count" integer NOT NULL,
	"conversation_history" text NOT NULL,
	"action_history" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "nextjs_post" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(256),
	"created_by_id" varchar(255) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "nextjs_session" (
	"session_token" varchar(255) PRIMARY KEY NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"expires" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "nextjs_user_block" (
	"blocker_id" varchar(255) NOT NULL,
	"blocked_id" varchar(255) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "nextjs_user_block_blocker_id_blocked_id_pk" PRIMARY KEY("blocker_id","blocked_id")
);
--> statement-breakpoint
CREATE TABLE "nextjs_user_role" (
	"user_id" varchar(255) NOT NULL,
	"role" varchar(32) NOT NULL,
	"granted_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "nextjs_user_role_user_id_role_pk" PRIMARY KEY("user_id","role")
);
--> statement-breakpoint
CREATE TABLE "nextjs_user" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"name" varchar(255),
	"email" varchar(255) NOT NULL,
	"email_verified" timestamp with time zone DEFAULT now(),
	"image" varchar(255),
	"handle" varchar(32),
	"password_hash" text,
	"bio" varchar(280),
	"profile_visibility" varchar(16) DEFAULT 'public' NOT NULL,
	"history_visibility" varchar(16) DEFAULT 'public' NOT NULL,
	"theme" varchar(16) DEFAULT 'dark' NOT NULL,
	"reduced_motion" boolean DEFAULT false NOT NULL,
	"sound_enabled" boolean DEFAULT true NOT NULL,
	"notifications_enabled" boolean DEFAULT true NOT NULL,
	"account_status" varchar(24) DEFAULT 'active' NOT NULL,
	"deleted_at" timestamp with time zone,
	"is_admin" boolean DEFAULT false NOT NULL,
	CONSTRAINT "nextjs_user_handle_unique" UNIQUE("handle")
);
--> statement-breakpoint
CREATE TABLE "nextjs_verification_token" (
	"identifier" varchar(255) NOT NULL,
	"token" varchar(255) NOT NULL,
	"expires" timestamp with time zone NOT NULL,
	CONSTRAINT "nextjs_verification_token_identifier_token_pk" PRIMARY KEY("identifier","token")
);
--> statement-breakpoint
ALTER TABLE "nextjs_account" ADD CONSTRAINT "nextjs_account_user_id_nextjs_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."nextjs_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nextjs_audit_log" ADD CONSTRAINT "nextjs_audit_log_actor_id_nextjs_user_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."nextjs_user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nextjs_audit_log" ADD CONSTRAINT "nextjs_audit_log_subject_id_nextjs_user_id_fk" FOREIGN KEY ("subject_id") REFERENCES "public"."nextjs_user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nextjs_friendship" ADD CONSTRAINT "nextjs_friendship_requester_id_nextjs_user_id_fk" FOREIGN KEY ("requester_id") REFERENCES "public"."nextjs_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nextjs_friendship" ADD CONSTRAINT "nextjs_friendship_addressee_id_nextjs_user_id_fk" FOREIGN KEY ("addressee_id") REFERENCES "public"."nextjs_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nextjs_match_participant" ADD CONSTRAINT "nextjs_match_participant_match_id_nextjs_match_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."nextjs_match"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nextjs_match_participant" ADD CONSTRAINT "nextjs_match_participant_user_id_nextjs_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."nextjs_user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nextjs_post" ADD CONSTRAINT "nextjs_post_created_by_id_nextjs_user_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."nextjs_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nextjs_session" ADD CONSTRAINT "nextjs_session_user_id_nextjs_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."nextjs_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nextjs_user_block" ADD CONSTRAINT "nextjs_user_block_blocker_id_nextjs_user_id_fk" FOREIGN KEY ("blocker_id") REFERENCES "public"."nextjs_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nextjs_user_block" ADD CONSTRAINT "nextjs_user_block_blocked_id_nextjs_user_id_fk" FOREIGN KEY ("blocked_id") REFERENCES "public"."nextjs_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nextjs_user_role" ADD CONSTRAINT "nextjs_user_role_user_id_nextjs_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."nextjs_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "account_user_id_idx" ON "nextjs_account" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "audit_log_subject_idx" ON "nextjs_audit_log" USING btree ("subject_id");--> statement-breakpoint
CREATE INDEX "friendship_addressee_idx" ON "nextjs_friendship" USING btree ("addressee_id");--> statement-breakpoint
CREATE INDEX "match_participant_match_idx" ON "nextjs_match_participant" USING btree ("match_id");--> statement-breakpoint
CREATE INDEX "match_participant_user_idx" ON "nextjs_match_participant" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "match_participant_username_idx" ON "nextjs_match_participant" USING btree ("username");--> statement-breakpoint
CREATE INDEX "match_ended_at_idx" ON "nextjs_match" USING btree ("ended_at");--> statement-breakpoint
CREATE INDEX "created_by_idx" ON "nextjs_post" USING btree ("created_by_id");--> statement-breakpoint
CREATE INDEX "name_idx" ON "nextjs_post" USING btree ("name");--> statement-breakpoint
CREATE INDEX "session_user_id_idx" ON "nextjs_session" USING btree ("user_id");