# Contributing

Thanks for helping with ByteMatch. This page covers the development setup and the rules for
changes.

## The clean-room rule

ByteMatch is a clean-room implementation. **Never copy code from decomp.dev**, and do not port it
from memory, decompiled bundles, or anywhere else. Its author reserves all rights to it. Base
compatibility work on decomp.dev's public behaviour only: URLs, query parameters, and the JSON its
public endpoints return.

objdiff (MIT OR Apache-2.0) is fine to use with attribution. Its `report.proto` and `changes.proto`
are vendored in `src/report/proto/` alongside `LICENSE-MIT.objdiff`; keep that license file with
them, and note the source when you adapt other objdiff code or schemas.

## Development setup

Requirements: Node 24, Yarn 4 (`corepack enable`), and Docker or Podman for the database.

```sh
docker compose up -d db     # Postgres 17 on 127.0.0.1:5432, user/password/db "bytematch"
cp .env.example .env
yarn install
yarn db:migrate
yarn dev                    # Next dev server on 0.0.0.0:5000
yarn worker:dev             # in a second terminal
```

Open http://localhost:5000. To work on sign-in, webhooks or PR comments, create a GitHub App for
development (see [docs/github-app.md](docs/github-app.md)); a tunnel such as `cloudflared` or
`ngrok` can expose the webhook endpoint.

## Tests

```sh
yarn test
```

Tests use Vitest. Database tests need a separate database; create it once in the compose Postgres:

```sh
docker compose exec db psql -U bytematch -c 'create database bytematch_test'
```

then run with:

```sh
TEST_DATABASE_URL=postgres://bytematch:bytematch@localhost:5432/bytematch_test yarn test
```

Without `TEST_DATABASE_URL`, database tests are skipped.

## Database migrations

After changing `src/db/schema.ts`:

```sh
yarn db:generate
```

Commit the generated migration in `drizzle/` together with the schema change. Apply it locally with
`yarn db:migrate`.

## Code style

Prettier formats and ESLint lints.

| Script           | Does                                    |
| ---------------- | --------------------------------------- |
| `yarn format`    | Format with Prettier                    |
| `yarn lint`      | ESLint                                  |
| `yarn typecheck` | TypeScript, no emit                     |
| `yarn test`      | Vitest                                  |
| `yarn check`     | Format check, lint, typecheck and tests |

Run `yarn check` before opening a pull request.

## Commits

Commits follow [Conventional Commits](https://www.conventionalcommits.org/).

### Format

```
type(optional-scope): summary

Body: what changed and why.

Optional footers, e.g. BREAKING CHANGE: ...
```

- The summary is in the imperative mood ("add", not "added" or "adds").
- The type is lower-case.
- No trailing period.
- The subject line is at most 72 characters.

### Types

| Type       | For                                                   |
| ---------- | ----------------------------------------------------- |
| `feat`     | A new feature                                         |
| `fix`      | A bug fix                                             |
| `docs`     | Documentation only                                    |
| `style`    | Formatting only, no change in behaviour               |
| `refactor` | Code changes that neither fix a bug nor add a feature |
| `perf`     | Performance improvements                              |
| `test`     | Adding or fixing tests                                |
| `build`    | Dependencies, bundling, the build itself              |
| `ci`       | CI configuration                                      |
| `chore`    | Anything else that does not touch `src/` or tests     |

### Scopes

Scopes used in this repository: `report`, `badge`, `db`, `github`, `ingest`, `worker`, `api`,
`web`, `auth`, `manage`, `deploy`, `docs`. The scope is optional; leave it out when a change spans
several areas.

### Breaking changes

Add `!` after the type or scope, and a `BREAKING CHANGE:` footer explaining what breaks and how to
adapt. A made-up example:

```
feat(api)!: require the commit parameter on uploads

BREAKING CHANGE: POST /api/v1/projects/{owner}/{repo}/reports now returns
400 without ?commit=. Pass the commit SHA, e.g. commit=$GITHUB_SHA.
```

### Granularity

- One logical change per commit.
- Every commit leaves `yarn check` passing.
- A schema change goes in one commit together with its generated migration in `drizzle/`.

### Examples

```
feat(api): upload reports with per-project tokens
fix(ingest): skip expired artifacts
feat(badge): accept decomp.dev style spellings
feat(db): store full reports deduplicated by sha-256
docs: explain the decomp.dev migration
```

## Code layout

| Directory    | Contents                                |
| ------------ | --------------------------------------- |
| `src/app`    | Pages and routes                        |
| `src/report` | objdiff report parsing, measures, diffs |
| `src/badge`  | SVG and PNG badges                      |
| `src/db`     | Schema, store, migrations               |
| `src/github` | GitHub App, artifacts, comments         |
| `src/ingest` | Ingest pipelines                        |
| `src/worker` | Job handlers                            |
| `src/lib`    | Configuration, queue, crypto            |

More in [docs/architecture.md](docs/architecture.md).

## License

By contributing you agree that your contributions are licensed under the
[GPL-3.0](LICENSE).
