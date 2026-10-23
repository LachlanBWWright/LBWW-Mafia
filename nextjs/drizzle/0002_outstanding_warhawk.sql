CREATE TABLE "nextjs_user_presence" (
	"user_id" varchar(255) PRIMARY KEY NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "nextjs_user_presence" ADD CONSTRAINT "nextjs_user_presence_user_id_nextjs_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."nextjs_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "user_presence_last_seen_idx" ON "nextjs_user_presence" USING btree ("last_seen_at");