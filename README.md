# ByteMatch

A self-hostable progress-tracking website for matching decompilation projects. It reads the
[objdiff](https://github.com/encounter/objdiff) `report.json` your CI already produces, keeps the
history, draws progress badges, and comments on pull requests.

A progress badge is one line of Markdown:

```markdown
![Code](https://<host>/OpenRAC/rac1-decomp.svg?label=Code&measure=matched_code_percent)
```

## Why

[decomp.dev](https://decomp.dev) was the community's progress site for decompilation projects,
and it did a great deal for that community. Thank you to encounter for building and running it.
It is now being sunset: new projects can no longer register, and existing project pages stay up
for now.

ByteMatch is a clean-room replacement. It contains no decomp.dev code. It is compatible with the
public URLs existing projects already use (project pages, `.json`, `.svg` and `.png` badges), so a
project can switch by changing the domain.

## Features

- **Zero CI changes** for projects that already upload `<VERSION>_report` artifacts
  (the dtk-template convention). ByteMatch reads them from successful default-branch runs.
- **Project pages**: measures, categories, a history chart, units with their functions, and recent
  commits, per game version.
- **Badges** in SVG and PNG, rendered by ByteMatch itself (no shields.io dependency), plus a
  shields.io endpoint mode.
- **JSON API** compatible with decomp.dev's `/{owner}/{repo}.json`, including history and full
  reports.
- **GitHub App**: instant updates through webhooks, and one progress comment per pull request
  (newly matched functions, regressions, measure changes).
- **Upload API** for projects not on GitHub or with private CI.
- **Import from decomp.dev**: copy a project's measure history and latest report while decomp.dev
  still serves them.
- **Self-hosting**: Next.js, PostgreSQL, and a background worker. No Redis. Run with pm2 or
  containers.

## Quick start: project maintainers

1. Sign in with GitHub on the ByteMatch instance, open **Manage**, and **Add project**. You must be
   an admin of the GitHub repository.
2. Make sure CI uploads objdiff's report as an artifact named `<VERSION>_report` on the default
   branch. dtk-template projects already do. Optionally install the instance's GitHub App on the
   repository for instant updates and PR comments.
3. Add a badge to your README:

   ```markdown
   ![Code](https://<host>/<owner>/<repo>.svg?label=Code&measure=matched_code_percent)
   ```

Coming from decomp.dev? See [Migrating from decomp.dev](docs/migrating-from-decomp-dev.md).

## Quick start: self-hosting

Requires Node 24, Yarn 4 and PostgreSQL 15+.

```sh
git clone https://github.com/Veradictus/ByteMatch.git && cd ByteMatch
cp .env.example .env            # set PUBLIC_URL, SECRET_KEY, GitHub settings
yarn install --immutable
yarn build
yarn db:migrate
yarn pm2:start                  # bytematch-web on 0.0.0.0:5000 and bytematch-worker
```

Or with containers: `docker compose --profile app up -d --build`.

Put a reverse proxy with TLS in front. See [Self-hosting](docs/self-hosting.md) and
[Creating the GitHub App](docs/github-app.md).

## Documentation

| Document                                                       | For                                                                          |
| -------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| [Getting started](docs/getting-started.md)                     | Project maintainers: registering, CI artifacts, badges, PR comments          |
| [Migrating from decomp.dev](docs/migrating-from-decomp-dev.md) | Projects moving their badges, links and history                              |
| [API](docs/api.md)                                             | Every public URL, query parameter and JSON shape, plus the upload API        |
| [GitHub App](docs/github-app.md)                               | Instance operators: creating and configuring the App                         |
| [Self-hosting](docs/self-hosting.md)                           | Instance operators: configuration, deployment, upgrades, backups             |
| [Architecture](docs/architecture.md)                           | Processes, data model, ingest flow, job queue                                |
| [Contributing](CONTRIBUTING.md)                                | Development setup, tests, code style, commit standard (Conventional Commits) |

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Commits follow Conventional Commits
(`type(scope): summary`), one logical change per commit, and `yarn check` must pass. Never copy
decomp.dev code.

## Credits

- [objdiff](https://github.com/encounter/objdiff) (MIT OR Apache-2.0) generates the progress
  reports. ByteMatch vendors objdiff's `report.proto` and `changes.proto` (in
  `src/report/proto/`, with `LICENSE-MIT.objdiff`) and reimplements its report parsing and
  migration rules.
- [decomp.dev](https://decomp.dev), for showing what a progress site for this community should be.

## License

[GPL-3.0](LICENSE). The vendored objdiff files keep their MIT license.
