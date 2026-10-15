CREATE TABLE "api_tokens" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" integer NOT NULL,
	"name" text NOT NULL,
	"token_hash" text NOT NULL,
	"prefix" text NOT NULL,
	"created_by" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_used_at" timestamp with time zone,
	CONSTRAINT "api_tokens_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "pr_comments" (
	"project_id" integer NOT NULL,
	"pr_number" integer NOT NULL,
	"comment_id" bigint NOT NULL,
	"head_sha" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" serial PRIMARY KEY NOT NULL,
	"github_id" bigint,
	"owner" text NOT NULL,
	"repo" text NOT NULL,
	"name" text NOT NULL,
	"short_name" text,
	"description" text,
	"platform" text,
	"default_version" text,
	"default_category" text,
	"default_branch" text DEFAULT 'main' NOT NULL,
	"artifact_pattern" text DEFAULT '^(?<version>.+)_report$' NOT NULL,
	"workflow" text,
	"split_versions" boolean DEFAULT false NOT NULL,
	"pr_comments" boolean DEFAULT true NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"installation_id" bigint,
	"last_polled_at" timestamp with time zone,
	"last_error" text,
	"last_error_at" timestamp with time zone,
	"created_by" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "projects_github_id_unique" UNIQUE("github_id")
);
--> statement-breakpoint
CREATE TABLE "report_blobs" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"sha256" text NOT NULL,
	"data" "bytea" NOT NULL,
	"size" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "report_blobs_sha256_unique" UNIQUE("sha256")
);
--> statement-breakpoint
CREATE TABLE "reports" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"project_id" integer NOT NULL,
	"version" text NOT NULL,
	"commit_sha" text NOT NULL,
	"commit_message" text,
	"commit_timestamp" timestamp with time zone NOT NULL,
	"source" text NOT NULL,
	"run_id" bigint,
	"measures" jsonb NOT NULL,
	"categories" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"blob_id" bigint,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"github_token" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"github_id" bigint NOT NULL,
	"login" text NOT NULL,
	"name" text,
	"avatar_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_github_id_unique" UNIQUE("github_id")
);
--> statement-breakpoint
ALTER TABLE "api_tokens" ADD CONSTRAINT "api_tokens_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "api_tokens" ADD CONSTRAINT "api_tokens_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pr_comments" ADD CONSTRAINT "pr_comments_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_blob_id_report_blobs_id_fk" FOREIGN KEY ("blob_id") REFERENCES "public"."report_blobs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "api_tokens_project_idx" ON "api_tokens" USING btree ("project_id");--> statement-breakpoint
CREATE UNIQUE INDEX "pr_comments_project_pr_idx" ON "pr_comments" USING btree ("project_id","pr_number");--> statement-breakpoint
CREATE UNIQUE INDEX "projects_owner_repo_idx" ON "projects" USING btree (lower("owner"),lower("repo"));--> statement-breakpoint
CREATE UNIQUE INDEX "reports_project_version_commit_idx" ON "reports" USING btree ("project_id","version","commit_sha");--> statement-breakpoint
CREATE INDEX "reports_project_version_time_idx" ON "reports" USING btree ("project_id","version","commit_timestamp" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "sessions_user_idx" ON "sessions" USING btree ("user_id");