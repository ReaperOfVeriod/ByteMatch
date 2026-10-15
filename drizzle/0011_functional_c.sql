CREATE TABLE "functional_lists" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"sha256" text NOT NULL,
	"entries" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "functional_lists_sha256_unique" UNIQUE("sha256")
);
--> statement-breakpoint
ALTER TABLE "reports" ADD COLUMN "functional" jsonb;--> statement-breakpoint
ALTER TABLE "reports" ADD COLUMN "functional_list_id" bigint;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_functional_list_id_functional_lists_id_fk" FOREIGN KEY ("functional_list_id") REFERENCES "public"."functional_lists"("id") ON DELETE set null ON UPDATE no action;