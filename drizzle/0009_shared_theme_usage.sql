ALTER TABLE "shared_themes" ADD COLUMN "last_used_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "shared_themes" ADD COLUMN "removed_at" timestamp with time zone;--> statement-breakpoint
CREATE INDEX "shared_themes_created_idx" ON "shared_themes" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "shared_themes_used_idx" ON "shared_themes" USING btree ("last_used_at");