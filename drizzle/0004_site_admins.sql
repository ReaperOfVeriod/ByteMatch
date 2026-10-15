CREATE TABLE "site_admins" (
	"id" serial PRIMARY KEY NOT NULL,
	"login" text NOT NULL,
	"github_id" bigint,
	"appointed_by" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "site_admins" ADD CONSTRAINT "site_admins_appointed_by_users_id_fk" FOREIGN KEY ("appointed_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "site_admins_login_idx" ON "site_admins" USING btree (lower("login"));