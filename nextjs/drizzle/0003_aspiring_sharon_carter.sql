CREATE TABLE "nextjs_custom_lobby" (
	"room_id" varchar(64) PRIMARY KEY NOT NULL,
	"owner_id" varchar(255) NOT NULL,
	"config" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
-- Legacy session rows are retained; authentication now uses JWT sessions.
ALTER TABLE "nextjs_custom_lobby" ADD CONSTRAINT "nextjs_custom_lobby_owner_id_nextjs_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."nextjs_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "custom_lobby_owner_idx" ON "nextjs_custom_lobby" USING btree ("owner_id");