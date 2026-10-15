CREATE TABLE "name_aliases" (
	"kind" text NOT NULL,
	"from_key" text NOT NULL,
	"from_name" text NOT NULL,
	"to_key" text NOT NULL,
	"to_name" text NOT NULL,
	"created_by" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "name_aliases_kind_from_key_pk" PRIMARY KEY("kind","from_key")
);
--> statement-breakpoint
ALTER TABLE "name_aliases" ADD CONSTRAINT "name_aliases_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;