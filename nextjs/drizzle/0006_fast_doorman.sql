CREATE TABLE "nextjs_party" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"leader_id" varchar(255) NOT NULL,
	"room_id" varchar(64),
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "nextjs_party_invitation" (
	"id" serial PRIMARY KEY NOT NULL,
	"party_id" varchar(36) NOT NULL,
	"sender_id" varchar(255) NOT NULL,
	"recipient_id" varchar(255) NOT NULL,
	"status" varchar(16) DEFAULT 'pending' NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "nextjs_party_member" (
	"party_id" varchar(36) NOT NULL,
	"user_id" varchar(255) PRIMARY KEY NOT NULL,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "nextjs_party" ADD CONSTRAINT "nextjs_party_leader_id_nextjs_user_id_fk" FOREIGN KEY ("leader_id") REFERENCES "public"."nextjs_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nextjs_party_invitation" ADD CONSTRAINT "nextjs_party_invitation_party_id_nextjs_party_id_fk" FOREIGN KEY ("party_id") REFERENCES "public"."nextjs_party"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nextjs_party_invitation" ADD CONSTRAINT "nextjs_party_invitation_sender_id_nextjs_user_id_fk" FOREIGN KEY ("sender_id") REFERENCES "public"."nextjs_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nextjs_party_invitation" ADD CONSTRAINT "nextjs_party_invitation_recipient_id_nextjs_user_id_fk" FOREIGN KEY ("recipient_id") REFERENCES "public"."nextjs_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nextjs_party_member" ADD CONSTRAINT "nextjs_party_member_party_id_nextjs_party_id_fk" FOREIGN KEY ("party_id") REFERENCES "public"."nextjs_party"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nextjs_party_member" ADD CONSTRAINT "nextjs_party_member_user_id_nextjs_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."nextjs_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "party_invitation_recipient_idx" ON "nextjs_party_invitation" USING btree ("recipient_id");--> statement-breakpoint
CREATE INDEX "party_member_party_idx" ON "nextjs_party_member" USING btree ("party_id");