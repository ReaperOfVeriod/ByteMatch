# Migrating from decomp.dev

decomp.dev is being sunset. Registration of new projects is closed, and it keeps serving existing
project pages and data for now. ByteMatch is compatible with decomp.dev's public URLs, so moving a
project is mostly a change of domain.

The public ByteMatch instance is [bytematch.dev](https://bytematch.dev). On a self-hosted instance, use
its domain instead.

## Summary

| Step                | What you do                                                                          |
| ------------------- | ------------------------------------------------------------------------------------ |
| 1. Register         | Sign in on ByteMatch and add the repository.                                         |
| 2. CI               | Nothing, if CI already uploads `<VERSION>_report` artifacts.                         |
| 3. Badges and links | Replace `decomp.dev` with `bytematch.dev`. Paths and query parameters stay the same. |
| 4. History          | Save your history files from decomp.dev now; ByteMatch imports or accepts them.      |
| 5. Tools            | Anything reading `decomp.dev/<owner>/<repo>.json` changes the host.                  |

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

decomp.dev still serves each project's history, but it won't forever. Save a copy now, even if
you register on ByteMatch later: once you have the files, your history no longer depends on
decomp.dev being up.

### Save the files

There is one history file per version. The version names are listed in your project's JSON
(`report_versions`):

```sh
curl -s https://decomp.dev/OpenRAC/rac1-decomp.json | jq -r '.report_versions[]'
```

Then download each version's history:

```sh
OWNER=OpenRAC REPO=rac1-decomp
for v in $(curl -s "https://decomp.dev/$OWNER/$REPO.json" | jq -r '.report_versions[]'); do
  curl -sf -o "$REPO-$v-history.json" "https://decomp.dev/$OWNER/$REPO.json?mode=history&version=$v"
done
```

Each file is a JSON array with one entry per commit (time, SHA, message and measures). It's small
enough to commit to your repository, which is a good place to keep it.

### Bring it into ByteMatch

On the project's manage page:

- **Import from decomp.dev** fetches the history and the latest full report straight from
  decomp.dev. ByteMatch runs it automatically when a project is added, so you only need it again
  if decomp.dev was unreachable at the time.
- **History → Upload history** takes a file you saved, one version at a time. This works after
  decomp.dev is gone. A gzipped file (`.json.gz`) is fine.
- **Backfill** reads older CI runs whose artifacts have not expired. GitHub keeps artifacts for 90
  days by default. Backfilled commits get full reports.

From CI or a script, upload with a project upload token (see [the API](api.md#history-upload)):

```sh
curl -X POST -H "Authorization: Bearer $BYTEMATCH_TOKEN" --data-binary @rac1-decomp-us-history.json \
  "https://bytematch.dev/api/v1/projects/OpenRAC/rac1-decomp/history?version=us"
```

History adds measures (the progress numbers and the chart) for each commit, but not full reports,
so older commits have no unit or function lists. Commits that already have data are never
overwritten, so importing, uploading and backfilling can be combined in any order and repeated.

ByteMatch serves history in the same format at `/<owner>/<repo>.json?mode=history&version=…`, and
the project page has a **Download** link next to the history chart. Your history can always leave
ByteMatch the same way it came in.

## 5. Tools and dashboards

Anything that reads `https://decomp.dev/<owner>/<repo>.json` (dashboards, websites, bots) only needs
the host changed to `https://bytematch.dev/<owner>/<repo>.json`. The fields and the `version`, `category`
and `mode` parameters are the same. See the [API reference](api.md).
