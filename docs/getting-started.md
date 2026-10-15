# Getting started

This guide is for maintainers of decompilation projects who want their progress tracked on a
ByteMatch instance. `<host>` stands for the instance's domain.

Moving from decomp.dev? Read [Migrating from decomp.dev](migrating-from-decomp-dev.md) instead; it
covers the same steps plus keeping your history.

## 1. Register the project

1. Open `https://<host>`, choose **Sign in with GitHub**.
2. Go to **Manage** → **Add project** and pick the repository.

You must be an admin of the GitHub repository, or a site admin of the instance. Some instances
turn off open registration; then only site admins can add projects, so ask the operator.

After registering, the project page is at `https://<host>/<owner>/<repo>`. It fills in once the
first report arrives.

## 2. Get reports to ByteMatch

ByteMatch reads [objdiff](https://github.com/encounter/objdiff) progress reports. There are three
ways to deliver them.

### CI artifacts (recommended)

Upload objdiff's report from GitHub Actions as an artifact named `<VERSION>_report`, for example
`GALE01_report` or `SCES_509.16_report`. Projects based on dtk-template already do this.

ByteMatch reads artifacts only from:

- **successful** workflow runs,
- on the project's **default branch**,
- triggered by **push** events (pull request runs are used for PR comments, not history).

A minimal workflow step after your build:

```yaml
- name: Generate progress report
  run: objdiff-cli report generate -o build/${VERSION}/report.json

- name: Upload progress report
  uses: actions/upload-artifact@v4
  with:
    name: ${{ env.VERSION }}_report
    path: build/${{ env.VERSION }}/report.json
```

Here `VERSION` is the game version, e.g. set with `env: VERSION: GALE01` on the job, or as a
matrix value. Use one artifact per version.

The worker checks for new runs every 15 minutes by default (the instance's
`POLL_INTERVAL_MINUTES`). If the instance's GitHub App is installed on your repository, a webhook
triggers ingestion as soon as the run finishes.

GitHub requires authentication to download artifacts, even from public repositories. The instance
uses its GitHub App if installed on your repository, otherwise a server-wide token. If reports do
not appear, installing the App is the most reliable fix.

#### Per-project artifact settings

Set these on the project's manage page if your CI differs from the default:

| Setting          | Default                   | Use                                                                                                                                                                    |
| ---------------- | ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Artifact pattern | `^(?<version>.+)_report$` | Regular expression for artifact names. The named group `version` is the game version.                                                                                  |
| Workflow         | all workflows             | Only read artifacts from this workflow file, e.g. `build.yml`.                                                                                                         |
| Split versions   | off                       | Your single report holds every version as top-level categories (objdiff's `version` / `version.category` convention). ByteMatch splits it into one report per version. |
| Default branch   | `main`                    | The branch whose runs count as progress.                                                                                                                               |

### GitHub App

Installing the instance's GitHub App on the repository gives instant updates (no polling delay) and
pull request comments. The link is on the project's manage page. See [PR comments](#4-pr-comments).

### Upload API

For projects not on GitHub, or with private CI, push reports directly. Create an upload token on
the project's manage page (it is shown once; store it as a CI secret such as `BYTEMATCH_TOKEN`),
then:

```sh
curl --fail -X POST \
  -H "Authorization: Bearer $BYTEMATCH_TOKEN" \
  --data-binary @build/GALE01/report.json \
  "https://<host>/api/v1/projects/<owner>/<repo>/reports?version=GALE01&commit=$GITHUB_SHA"
```

Full details are in the [API reference](api.md#upload-api).

## 3. Badges

Add badges to your README. `measure` picks what to show:

```markdown
![Code](https://<host>/<owner>/<repo>.svg?label=Code&measure=matched_code_percent)
![Data](https://<host>/<owner>/<repo>.svg?label=Data&measure=matched_data_percent)
![Functions](https://<host>/<owner>/<repo>.svg?label=Functions&measure=matched_functions)
```

Percent measures read like `86.02%`; `matched_functions` and `complete_units` read like
`4,520 / 5,109`. Use `.png` instead of `.svg` where SVG is not supported. Add `version=` or
`category=` for a specific version or category, and `style=` for `flat-square`, `plastic` or
`for-the-badge`.

Every parameter is listed in the [API reference](api.md#badges).

## 4. PR comments

With the GitHub App installed, ByteMatch comments on pull requests. When a PR's workflow run
uploads a report, ByteMatch compares it with the latest report for the same version on the base
branch and posts one comment per PR, listing:

- newly matched functions,
- regressions,
- changes in the measures.

Later runs on the same PR update that comment rather than adding new ones. Turn PR comments off on
the project's manage page.

## Manage page reference

Signed-in admins of the repository can change:

- display name, short name, platform, default version, default category, default branch;
- artifact pattern, workflow restriction, split versions;
- PR comments on or off, and whether the project is enabled;
- upload tokens (create and revoke).

Actions:

- **Poll now**: check GitHub for new runs immediately.
- **Backfill**: read older CI runs whose artifacts have not expired yet (GitHub keeps artifacts
  90 days by default).
- **Import from decomp.dev**: copy history from decomp.dev (see the
  [migration guide](migrating-from-decomp-dev.md#4-keep-your-history)).

If the last ingest failed, the error is shown on this page.
