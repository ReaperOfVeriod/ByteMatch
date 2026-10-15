CREATE TABLE "shared_themes" (
	"code" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"palette" jsonb NOT NULL,
	"style" jsonb NOT NULL,
	"content_hash" text NOT NULL,
	"sharer_hash" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "shared_themes_content_hash_unique" UNIQUE("content_hash")
);
--> statement-breakpoint
CREATE INDEX "shared_themes_sharer_idx" ON "shared_themes" USING btree ("sharer_hash","created_at");