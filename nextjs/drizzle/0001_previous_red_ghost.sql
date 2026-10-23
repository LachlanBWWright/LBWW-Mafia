CREATE TABLE "nextjs_direct_conversation_member" (
	"conversation_id" integer NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"last_read_at" timestamp with time zone,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "nextjs_direct_conversation_member_conversation_id_user_id_pk" PRIMARY KEY("conversation_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "nextjs_direct_conversation" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_a_id" varchar(255) NOT NULL,
	"user_b_id" varchar(255) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "nextjs_direct_message" (
	"id" serial PRIMARY KEY NOT NULL,
	"conversation_id" integer NOT NULL,
	"sender_id" varchar(255) NOT NULL,
	"body" varchar(2000) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"edited_at" timestamp with time zone,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "nextjs_direct_conversation_member" ADD CONSTRAINT "nextjs_direct_conversation_member_conversation_id_nextjs_direct_conversation_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."nextjs_direct_conversation"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nextjs_direct_conversation_member" ADD CONSTRAINT "nextjs_direct_conversation_member_user_id_nextjs_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."nextjs_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nextjs_direct_conversation" ADD CONSTRAINT "nextjs_direct_conversation_user_a_id_nextjs_user_id_fk" FOREIGN KEY ("user_a_id") REFERENCES "public"."nextjs_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nextjs_direct_conversation" ADD CONSTRAINT "nextjs_direct_conversation_user_b_id_nextjs_user_id_fk" FOREIGN KEY ("user_b_id") REFERENCES "public"."nextjs_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nextjs_direct_message" ADD CONSTRAINT "nextjs_direct_message_conversation_id_nextjs_direct_conversation_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."nextjs_direct_conversation"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nextjs_direct_message" ADD CONSTRAINT "nextjs_direct_message_sender_id_nextjs_user_id_fk" FOREIGN KEY ("sender_id") REFERENCES "public"."nextjs_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "direct_conversation_member_user_idx" ON "nextjs_direct_conversation_member" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "direct_conversation_pair_idx" ON "nextjs_direct_conversation" USING btree ("user_a_id","user_b_id");--> statement-breakpoint
CREATE INDEX "direct_conversation_user_a_idx" ON "nextjs_direct_conversation" USING btree ("user_a_id");--> statement-breakpoint
CREATE INDEX "direct_conversation_user_b_idx" ON "nextjs_direct_conversation" USING btree ("user_b_id");--> statement-breakpoint
CREATE INDEX "direct_message_conversation_idx" ON "nextjs_direct_message" USING btree ("conversation_id","created_at");--> statement-breakpoint
CREATE INDEX "direct_message_sender_idx" ON "nextjs_direct_message" USING btree ("sender_id");