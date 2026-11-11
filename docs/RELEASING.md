# How changes reach production

`main` is always releasable, and every change reaches it through a pull request. A merged PR is
verified again, deployed to production, smoke-tested and recorded as a release, with no manual steps.
If the smoke test fails, the Worker rolls back by itself.

```
branch ─▶ pull request ─▶ CI (Verify, PR title) ─▶ squash merge ─▶ Deploy ─▶ Release
                                                                      │
                  plan ─▶ verify ─▶ API (migrate, deploy, smoke) ─▶ site (deploy, smoke) ─▶ tag
```

## Day to day

1. Branch from `main`: `feat/short-name`, `fix/short-name`, `chore/short-name`.
2. Open a pull request. **The PR title is what lands on main and in the release notes**, so it must be
   `type(scope): lower-case summary`, for example `fix(web): center the auth toasts`.
   - Types: `feat fix perf refactor chore docs test ci revert`
   - Scopes: `web backend ui types api-client landing user-app admin waitlist deps repo`
3. CI runs on the PR. **Verify** (lint for the whole repo, then typecheck, tests and build for the
   packages the PR touches) and **Conventional title** must pass. Dependency review runs too.
4. Merge with **Squash and merge** (the only option). Turn on auto-merge to let it merge by itself once
   the checks pass. The branch is deleted.
5. The **Deploy** workflow starts on its own. Watch it under the Actions tab.

Never push to `main` directly. The ruleset blocks it, force-pushes and deletion.

## What Deploy does

| Step | What happens |
|---|---|
| Plan | Compares the commit with the last `release-*` tag and decides whether the API, the site or both changed. A change to `.github/workflows` or `.github/scripts` redeploys both. |
| Verify merged commit | Lint, typecheck, test and build of the merged result, not just the PR. |
| Deploy API Worker | Applies D1 migrations, deploys `matr-api`, runs the API smoke test. |
| Deploy site Worker | Runs after the API so the site never ships ahead of what it calls. Builds, deploys, runs the site smoke test. |
| Record release | Creates tag `release-YYYY.MM.DD-<run>` and a GitHub Release whose notes list the merged PR titles. |

A tag is only written after a fully successful deploy. If a run fails halfway, the next run compares
against the older tag and picks up what is still missing. Deploys never overlap, and a queued run is
replaced by a newer one, which is safe because every run ships the head of `main`.

**Run it by hand:** Actions → Deploy → Run workflow → pick `auto`, `web`, `backend` or `both`.

## Rolling back

- **Automatic:** if the smoke test fails right after a deploy, that Worker returns to its previous
  version and the run is marked failed.
- **Manual:** Actions → Rollback → choose `web` or `backend`, give a reason, and optionally a version ID
  (`wrangler deployments list` shows them). Empty means the previous version.
- A rollback only moves code. After it, fix forward with a normal PR. The next deploy ships the fix.

## Database migrations

Migrations (`packages/backend/migrations`) are applied **before** the new Worker goes live and are **never
rolled back**. The Worker that is still serving, or the one a rollback returns to, has to keep working
against the new schema. So:

- Add tables and nullable or defaulted columns freely.
- To remove or rename something, do it in two releases: first stop using it in code and ship that, then
  drop it in a later migration.
- Never edit a migration that has been merged. Add a new one.

## Hotfix

Same path, only faster: branch, small PR, merge as soon as Verify is green. Production only changes via
`main`, so there is no side door. If a release is broken and you need it gone first, roll back, then fix.

## Secrets and environments

- Cloudflare credentials (`CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`) are secrets of the GitHub
  **production** environment, which only `main` can deploy to. They are not repository secrets, so a PR
  workflow cannot read them. Use a token scoped to Workers and D1 edit, never the Global API key.
- App secrets (`BETTER_AUTH_SECRET`, `RESEND_API_KEY`, Turnstile, Google) live in Cloudflare
  (`wrangler secret put` or the dashboard). They are never in the repo or in Actions.
- GitHub secret scanning with push protection is on, so a pushed token is blocked.
- Workflows get a read-only token by default. Only the release job asks for `contents: write`.

## Dependencies and security

- **Dependabot** opens weekly grouped PRs for npm and for GitHub Actions, and security fixes as they
  appear. Treat them like any PR: green checks, squash merge.
- **Weekly audit** (`pnpm audit --prod`) runs on Mondays and goes red on a high-severity advisory.
- **CodeQL** scans the code on pushes and pull requests.

## One-time setup

After this pipeline is on `main`, a repository admin runs:

```
gh auth login
bash scripts/github-setup.sh
```

It sets squash-only merges, secret scanning, Dependabot alerts, restricts the production environment to
`main`, turns on CodeQL, and creates the `main` ruleset from `.github/rulesets/main.json`. It is safe to
run again. If GitHub itself is down and a fix cannot wait, an admin can set the ruleset to
"Disabled" under Settings → Rules, merge, and turn it back on.

## Not here yet

- **A staging environment.** It needs its own D1 database, queue and secrets so that previews never touch
  production data, which the security spec forbids. Until then, pull requests are verified by CI and
  by the smoke test after deploy. Add staging before the first paying users.
- **Required reviews.** The ruleset needs 0 approvals while the team is one person. Raise it, and turn on
  Code Owners review (`.github/CODEOWNERS`), when someone joins.
