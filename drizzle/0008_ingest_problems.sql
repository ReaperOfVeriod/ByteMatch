CREATE TABLE "ingest_problems" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" integer NOT NULL,
	"run_id" bigint NOT NULL,
	"commit_sha" text NOT NULL,
	"artifact" text NOT NULL,
	"code" text NOT NULL,
	"message" text NOT NULL,
	"detail" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ingest_problems" ADD CONSTRAINT "ingest_problems_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "ingest_problems_run_artifact_idx" ON "ingest_problems" USING btree ("project_id","run_id","artifact");