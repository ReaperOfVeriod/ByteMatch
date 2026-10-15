import { sql } from "drizzle-orm";
import {
  bigint,
  bigserial,
  boolean,
  customType,
  index,
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import type { Measures, ReportCategory } from "../report/types";

const bytea = customType<{ data: Uint8Array; driverData: Uint8Array }>({
  dataType: () => "bytea",
});

const created = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  githubId: bigint("github_id", { mode: "number" }).notNull().unique(),
  login: text("login").notNull(),
  name: text("name"),
  avatarUrl: text("avatar_url"),
  createdAt: created(),
});

/** A signed-in browser. The id is the SHA-256 of the cookie value; the GitHub token is encrypted. */
export const sessions = pgTable(
  "sessions",
  {
    id: text("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    githubToken: text("github_token").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: created(),
  },
  (t) => [index("sessions_user_idx").on(t.userId)],
);

export type CategoryMeasures = Pick<ReportCategory, "id" | "name" | "measures">;

export const projects = pgTable(
  "projects",
  {
    id: serial("id").primaryKey(),
    /** GitHub's repository id: survives renames and transfers. */
    githubId: bigint("github_id", { mode: "number" }).unique(),
    owner: text("owner").notNull(),
    repo: text("repo").notNull(),
    name: text("name").notNull(),
    shortName: text("short_name"),
    description: text("description"),
    /** Platform id, e.g. "gc", "ps2", "n64" (see src/lib/platforms.ts). */
    platform: text("platform"),
    defaultVersion: text("default_version"),
    defaultCategory: text("default_category"),
    defaultBranch: text("default_branch").notNull().default("main"),
    /** Artifact names that carry reports; the "version" group names the game version. */
    artifactPattern: text("artifact_pattern").notNull().default("^(?<version>.+)_report$"),
    /** Only read artifacts from this workflow file (e.g. "build.yml"); null reads all workflows. */
    workflow: text("workflow"),
    /** The report holds every version as top-level categories (objdiff's split convention). */
    splitVersions: boolean("split_versions").notNull().default(false),
    prComments: boolean("pr_comments").notNull().default(true),
    enabled: boolean("enabled").notNull().default(true),
    /** GitHub App installation that covers this repository, when there is one. */
    installationId: bigint("installation_id", { mode: "number" }),
    lastPolledAt: timestamp("last_polled_at", { withTimezone: true }),
    lastError: text("last_error"),
    lastErrorAt: timestamp("last_error_at", { withTimezone: true }),
    createdBy: integer("created_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: created(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("projects_owner_repo_idx").on(sql`lower(${t.owner})`, sql`lower(${t.repo})`)],
);

/** A full report, stored once however many commits share it: gzip of the objdiff protobuf. */
export const reportBlobs = pgTable("report_blobs", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  sha256: text("sha256").notNull().unique(),
  data: bytea("data").notNull(),
  size: integer("size").notNull(),
  createdAt: created(),
});

/** One version's progress at one commit. Measures are kept forever; the full report may expire. */
export const reports = pgTable(
  "reports",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    projectId: integer("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    version: text("version").notNull(),
    commitSha: text("commit_sha").notNull(),
    commitMessage: text("commit_message"),
    commitTimestamp: timestamp("commit_timestamp", { withTimezone: true }).notNull(),
    /** "artifact" (CI artifact), "upload" (upload API) or "import" (decomp.dev history). */
    source: text("source").notNull(),
    runId: bigint("run_id", { mode: "number" }),
    measures: jsonb("measures").$type<Measures>().notNull(),
    categories: jsonb("categories").$type<CategoryMeasures[]>().notNull().default([]),
    blobId: bigint("blob_id", { mode: "number" }).references(() => reportBlobs.id, { onDelete: "set null" }),
    createdAt: created(),
  },
  (t) => [
    uniqueIndex("reports_project_version_commit_idx").on(t.projectId, t.version, t.commitSha),
    index("reports_project_version_time_idx").on(t.projectId, t.version, t.commitTimestamp.desc()),
  ],
);

/** Per-project upload tokens: only a hash is stored. */
export const apiTokens = pgTable(
  "api_tokens",
  {
    id: serial("id").primaryKey(),
    projectId: integer("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    tokenHash: text("token_hash").notNull().unique(),
    /** The first characters, so owners can tell tokens apart. */
    prefix: text("prefix").notNull(),
    createdBy: integer("created_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: created(),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
  },
  (t) => [index("api_tokens_project_idx").on(t.projectId)],
);

/** The progress comment on each pull request, so later runs edit it instead of adding more. */
export const prComments = pgTable(
  "pr_comments",
  {
    projectId: integer("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    prNumber: integer("pr_number").notNull(),
    commentId: bigint("comment_id", { mode: "number" }).notNull(),
    headSha: text("head_sha"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("pr_comments_project_pr_idx").on(t.projectId, t.prNumber)],
);

export type Project = typeof projects.$inferSelect;
export type NewProject = typeof projects.$inferInsert;
export type ReportRow = typeof reports.$inferSelect;
export type User = typeof users.$inferSelect;
