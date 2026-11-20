CREATE TABLE "nextjs_quick_join_room" (
  "room_id" varchar(36) PRIMARY KEY NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
INSERT INTO "nextjs_quick_join_room" ("room_id", "created_at")
SELECT "room_id", "updated_at" FROM "nextjs_active_room"
ON CONFLICT DO NOTHING;
