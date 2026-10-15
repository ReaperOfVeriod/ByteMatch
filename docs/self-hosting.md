# Self-hosting

ByteMatch runs as two processes, a Next.js web server and a background worker, sharing one
PostgreSQL database. There is no Redis; the job queue (pg-boss) lives in Postgres.

## Requirements

- Node.js 24
- Yarn 4 (the repository pins 4.18.1; enable it with `corepack enable`)
- PostgreSQL 15 or newer
- A domain and a reverse proxy with TLS
- A GitHub App (see [Creating the GitHub App](github-app.md)) or at least a `GITHUB_TOKEN`

Or Docker / Podman with Compose, which provides Node and Postgres for you.

## Configuration

Settings are environment variables. Copy `.env.example` to `.env`; the file is read by
`next start`, the worker and the migrations.

| Variable                 | Default                                                   | Description                                                                                                                                       |
| ------------------------ | --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`           | `postgres://bytematch:bytematch@localhost:5432/bytematch` | PostgreSQL connection string.                                                                                                                     |
| `PUBLIC_URL`             | `http://localhost:5000`                                   | Public address of the instance, used in links, badges and PR comments.                                                                            |
| `SITE_NAME`              | `ByteMatch`                                               | Shown in the header and page titles.                                                                                                              |
| `GITHUB_TOKEN`           |                                                           | Optional fine-grained PAT (public read is enough) for downloading artifacts from repositories without the App.                                    |
| `GITHUB_APP_ID`          |                                                           | GitHub App id.                                                                                                                                    |
| `GITHUB_APP_PRIVATE_KEY` |                                                           | The App's private key PEM. Literal `\n` sequences are allowed.                                                                                    |
| `GITHUB_APP_SLUG`        |                                                           | App slug, for the "Install the App" link.                                                                                                         |
| `GITHUB_WEBHOOK_SECRET`  |                                                           | Webhook secret set on the App.                                                                                                                    |
| `GITHUB_CLIENT_ID`       |                                                           | The App's OAuth client id, for sign-in.                                                                                                           |
| `GITHUB_CLIENT_SECRET`   |                                                           | The App's OAuth client secret.                                                                                                                    |
| `SECRET_KEY`             |                                                           | 32 random bytes as 64 hex characters or base64 (`openssl rand -hex 32`). Encrypts signed-in users' GitHub tokens. Sign-in is disabled without it. |
| `ADMIN_GITHUB_LOGINS`    |                                                           | Comma-separated GitHub logins who can manage every project.                                                                                       |
| `OPEN_REGISTRATION`      | `true`                                                    | `false` makes adding projects admin-only.                                                                                                         |
| `POLL_INTERVAL_MINUTES`  | `15`                                                      | How often the worker checks projects for new CI runs.                                                                                             |
| `REPORT_RETENTION_DAYS`  | `0`                                                       | `0` keeps everything. Otherwise full reports older than this are dropped, except each version's latest. Measures and history are kept forever.    |
| `MAX_REPORT_BYTES`       | `268435456` (256 MiB)                                     | Largest report accepted.                                                                                                                          |
| `DECOMP_DEV_URL`         | `https://decomp.dev`                                      | Source for "Import from decomp.dev".                                                                                                              |
| `WORKER_CONCURRENCY`     | `4`                                                       | Jobs each worker process runs at once.                                                                                                            |

Sign-in needs `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET` and `SECRET_KEY`. Webhooks, PR comments and
installation tokens need `GITHUB_APP_ID`, `GITHUB_APP_PRIVATE_KEY` and `GITHUB_WEBHOOK_SECRET`.

## Deploying with pm2

```sh
git clone https://github.com/Veradictus/ByteMatch.git
cd ByteMatch
cp .env.example .env        # then edit it
yarn install --immutable
yarn build                  # Next build, plus dist/main.js (worker) and dist/migrate.js (migrator)
yarn db:migrate
yarn pm2:start
pm2 save
pm2 startup                 # prints a command that makes pm2 start at boot; run it
```

`yarn pm2:start` starts `ecosystem.config.cjs`, which defines two apps:

| pm2 app            | Runs                            |
| ------------------ | ------------------------------- |
| `bytematch-web`    | `next start -H 0.0.0.0 -p 5000` |
| `bytematch-worker` | `dist/main.js`                  |

Other scripts: `yarn pm2:reload`, `yarn pm2:stop`, `yarn pm2:logs`.

The web server listens on `0.0.0.0:5000`. Firewall that port and expose only the reverse proxy.

## Deploying with containers

```sh
cp .env.example .env        # then edit it
docker compose --profile app up -d --build
```

| Service   | Role                                                                        |
| --------- | --------------------------------------------------------------------------- |
| `db`      | PostgreSQL 17, on `127.0.0.1:5432`, user, password and database `bytematch` |
| `migrate` | Runs the migrations, then exits                                             |
| `web`     | The website, on port 5000                                                   |
| `worker`  | The background worker                                                       |

`web` and `worker` start after `migrate` succeeds. The compose file sets `DATABASE_URL` to the `db`
service, overriding `.env`. Change the default database password before exposing anything beyond
the host.

All three app services use one image, built from `Containerfile`. To run it without Compose:

```sh
docker build -t bytematch -f Containerfile .          # or: podman build -t bytematch .
docker run --env-file .env bytematch node dist/migrate.js
docker run -d -p 5000:5000 --env-file .env bytematch  # web
docker run -d --env-file .env bytematch node dist/main.js   # worker
```

## Reverse proxy

Put a reverse proxy with TLS in front of port 5000. A Caddyfile:

```caddyfile
<host> {
	reverse_proxy 127.0.0.1:5000
}
```

Caddy obtains the certificate itself. With several web instances, list them all:
`reverse_proxy 127.0.0.1:5000 127.0.0.1:5001`.

Uploads can be large (up to `MAX_REPORT_BYTES`); if your proxy limits request body size, raise the
limit for `/api/v1/projects/*`.

## Upgrades

pm2:

```sh
git pull && yarn install --immutable && yarn build && yarn db:migrate && yarn pm2:reload
```

Containers:

```sh
git pull && docker compose --profile app up -d --build
```

The `migrate` service runs before `web` and `worker` start again.

## Backups

Everything lives in PostgreSQL: projects, history, full reports, tokens and the job queue.

```sh
pg_dump -Fc "$DATABASE_URL" > bytematch-$(date +%F).dump
```

With the compose database:

```sh
docker compose exec -T db pg_dump -Fc -U bytematch bytematch > bytematch-$(date +%F).dump
```

Restore with `pg_restore -d <database> --clean bytematch-YYYY-MM-DD.dump`. Also keep a copy of
`.env`: without the same `SECRET_KEY`, stored user tokens cannot be decrypted and users must sign
in again.

To reduce database size, set `REPORT_RETENTION_DAYS`. Measures and history are never dropped.

## Scaling

The web and worker processes are stateless.

- **Web**: with pm2, raise `instances` for `bytematch-web` in `ecosystem.config.cjs` (it runs in
  cluster mode, so the processes share port 5000). On several machines, list each one in the proxy.
- **Worker**: run more worker processes, or raise `WORKER_CONCURRENCY`. Jobs are claimed through
  Postgres, so each runs once, and duplicate webhook jobs for the same run collapse into one.

The database is the only shared component.
