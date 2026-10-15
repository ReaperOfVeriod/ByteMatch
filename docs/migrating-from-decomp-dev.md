# Migrating from decomp.dev

decomp.dev is being sunset. Registration of new projects is closed, and it keeps serving existing
project pages and data for now. ByteMatch is compatible with decomp.dev's public URLs, so moving a
project is mostly a change of domain.

The public ByteMatch instance is [bytematch.dev](https://bytematch.dev). On a self-hosted instance, use
its domain instead.

## Summary

| Step                | What you do                                                                                |
| ------------------- | ------------------------------------------------------------------------------------------ |
| 1. Register         | Sign in on ByteMatch and add the repository.                                               |
| 2. CI               | Nothing, if CI already uploads `<VERSION>_report` artifacts.                               |
| 3. Badges and links | Replace `decomp.dev` with `bytematch.dev`. Paths and query parameters stay the same.       |
| 4. History          | Run **Import from decomp.dev** on the manage page while decomp.dev still serves your data. |
| 5. Tools            | Anything reading `decomp.dev/<owner>/<repo>.json` changes the host.                        |

## 1. Register the project

Sign in with GitHub on `https://bytematch.dev`, then **Manage** → **Add project**. You must be an admin of
the GitHub repository, or a site admin of the instance (listed in its `ADMIN_GITHUB_LOGINS`).

Instance operators can set `OPEN_REGISTRATION=false` to make adding projects admin-only. If you
cannot add your project, ask the operator.

## 2. CI

Nothing changes if your workflow already uploads objdiff's report as an artifact named
`<VERSION>_report` (for example `GALE01_report`), as dtk-template projects do. ByteMatch reads
these artifacts from successful runs on the default branch.

If your project used custom artifact names, a specific workflow, or a single report holding every
version, set the artifact pattern, workflow restriction or split versions on the manage page. See
[Getting started](getting-started.md#per-project-artifact-settings).

Installing the instance's GitHub App on the repository is optional but gives instant updates and
PR comments.

## 3. Badges and links

Replace the domain. URL paths and query parameters stay the same.

Before:

```markdown
[![Code](https://decomp.dev/OpenRAC/rac1-decomp.svg?mode=shield&label=Code&measure=matched_code_percent)](https://decomp.dev/OpenRAC/rac1-decomp)
```

After:

```markdown
[![Code](https://bytematch.dev/OpenRAC/rac1-decomp.svg?mode=shield&label=Code&measure=matched_code_percent)](https://bytematch.dev/OpenRAC/rac1-decomp)
```

Badges using shields.io's endpoint mode change the same way.

Before:

```markdown
![Progress](https://img.shields.io/endpoint?url=https%3A%2F%2Fdecomp.dev%2FOpenRAC%2Frac1-decomp.json%3Fmode%3Dshield)
```

After:

```markdown
![Progress](https://img.shields.io/endpoint?url=https%3A%2F%2Fbytematch.dev%2FOpenRAC%2Frac1-decomp.json%3Fmode%3Dshield)
```

ByteMatch draws `.svg` and `.png` badges itself, so the direct badge URL is the simpler choice.

All badge styles decomp.dev accepted still work, including spellings like `FlatSquare` and
`ForTheBadge`. `Social` is rendered as `flat`.

A quick way to update a README:

```sh
sed -i 's#https://decomp.dev/#https://bytematch.dev/#g' README.md
```

## 4. Keep your history

On the project's manage page:

- **Import from decomp.dev** copies the project's measure history (from decomp.dev's
  `/<owner>/<repo>.json?mode=history`) and its latest full report. Run it while decomp.dev still
  serves your project. Imported history has measures for each commit, but not full reports, so
  older commits show progress numbers and charts but not unit and function lists.
- **Backfill** reads older CI runs whose artifacts have not expired. GitHub keeps artifacts for
  90 days by default. Backfilled commits get full reports.

You can run both. Run the import first to get the long history, then backfill to get full reports
for recent commits.

## 5. Tools and dashboards

Anything that reads `https://decomp.dev/<owner>/<repo>.json` (dashboards, websites, bots) only needs
the host changed to `https://bytematch.dev/<owner>/<repo>.json`. The fields and the `version`, `category`
and `mode` parameters are the same. See the [API reference](api.md).
