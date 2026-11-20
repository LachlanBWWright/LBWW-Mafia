CREATE TABLE "nextjs_campaign_member" (
	"campaign_id" varchar(36) NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "nextjs_campaign_member_campaign_id_user_id_pk" PRIMARY KEY("campaign_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "nextjs_campaign_round" (
	"campaign_id" varchar(36) NOT NULL,
	"match_id" integer NOT NULL,
	CONSTRAINT "nextjs_campaign_round_campaign_id_match_id_pk" PRIMARY KEY("campaign_id","match_id")
);
--> statement-breakpoint
CREATE TABLE "nextjs_campaign_vote" (
	"campaign_id" varchar(36) NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"pack_code" text NOT NULL,
	CONSTRAINT "nextjs_campaign_vote_campaign_id_user_id_pk" PRIMARY KEY("campaign_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "nextjs_campaign" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"name" varchar(80) NOT NULL,
	"owner_id" varchar(255) NOT NULL,
	"host_id" varchar(255) NOT NULL,
	"share_code" varchar(32) NOT NULL,
	CONSTRAINT "nextjs_campaign_share_code_unique" UNIQUE("share_code")
);
--> statement-breakpoint
CREATE TABLE "nextjs_replay_annotation" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"match_id" integer NOT NULL,
	"author_id" varchar(255) NOT NULL,
	"event_index" integer NOT NULL,
	"text" varchar(1000) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "nextjs_replay_nomination" (
	"match_id" integer NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"nominee_id" varchar(255) NOT NULL,
	"event_index" integer NOT NULL,
	CONSTRAINT "nextjs_replay_nomination_match_id_user_id_pk" PRIMARY KEY("match_id","user_id")
);
--> statement-breakpoint
ALTER TABLE "nextjs_campaign_member" ADD CONSTRAINT "nextjs_campaign_member_campaign_id_nextjs_campaign_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."nextjs_campaign"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nextjs_campaign_member" ADD CONSTRAINT "nextjs_campaign_member_user_id_nextjs_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."nextjs_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nextjs_campaign_round" ADD CONSTRAINT "nextjs_campaign_round_campaign_id_nextjs_campaign_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."nextjs_campaign"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nextjs_campaign_round" ADD CONSTRAINT "nextjs_campaign_round_match_id_nextjs_match_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."nextjs_match"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nextjs_campaign_vote" ADD CONSTRAINT "nextjs_campaign_vote_campaign_id_nextjs_campaign_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."nextjs_campaign"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nextjs_campaign_vote" ADD CONSTRAINT "nextjs_campaign_vote_user_id_nextjs_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."nextjs_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nextjs_campaign" ADD CONSTRAINT "nextjs_campaign_owner_id_nextjs_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."nextjs_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nextjs_campaign" ADD CONSTRAINT "nextjs_campaign_host_id_nextjs_user_id_fk" FOREIGN KEY ("host_id") REFERENCES "public"."nextjs_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nextjs_replay_annotation" ADD CONSTRAINT "nextjs_replay_annotation_match_id_nextjs_match_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."nextjs_match"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nextjs_replay_annotation" ADD CONSTRAINT "nextjs_replay_annotation_author_id_nextjs_user_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."nextjs_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nextjs_replay_nomination" ADD CONSTRAINT "nextjs_replay_nomination_match_id_nextjs_match_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."nextjs_match"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nextjs_replay_nomination" ADD CONSTRAINT "nextjs_replay_nomination_user_id_nextjs_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."nextjs_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nextjs_replay_nomination" ADD CONSTRAINT "nextjs_replay_nomination_nominee_id_nextjs_user_id_fk" FOREIGN KEY ("nominee_id") REFERENCES "public"."nextjs_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "replay_annotation_match_idx" ON "nextjs_replay_annotation" USING btree ("match_id");