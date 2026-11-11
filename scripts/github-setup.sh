#!/usr/bin/env bash
# One-time (and safe to re-run) GitHub repository setup for the release pipeline in docs/RELEASING.md.
#
# Run it AFTER the pipeline files are on main, because the main ruleset requires the "Verify" and
# "Conventional title" checks, and from then on nothing can be pushed to main directly.
#
#   gh auth login          # as a repository admin
#   bash scripts/github-setup.sh
set -euo pipefail

repo="${1:-$(gh repo view --json nameWithOwner --jq .nameWithOwner)}"
root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
echo "Configuring $repo"

api() { gh api "$@" >/dev/null; }

echo "- merge settings: squash only, PR title as the commit, branches deleted after merge"
api -X PATCH "repos/$repo" --input - <<'JSON'
{
  "allow_squash_merge": true,
  "allow_merge_commit": false,
  "allow_rebase_merge": false,
  "allow_auto_merge": true,
  "delete_branch_on_merge": true,
  "squash_merge_commit_title": "PR_TITLE",
  "squash_merge_commit_message": "BLANK",
  "security_and_analysis": {
    "secret_scanning": { "status": "enabled" },
    "secret_scanning_push_protection": { "status": "enabled" }
  }
}
JSON

echo "- Actions: workflows get a read-only token by default and cannot approve PRs"
api -X PUT "repos/$repo/actions/permissions/workflow" --input - <<'JSON'
{ "default_workflow_permissions": "read", "can_approve_pull_request_reviews": false }
JSON

echo "- Dependabot alerts and security updates"
api -X PUT "repos/$repo/vulnerability-alerts"
api -X PUT "repos/$repo/automated-security-fixes"

echo "- production environment: deployable from main only"
api -X PUT "repos/$repo/environments/production" --input - <<'JSON'
{ "deployment_branch_policy": { "protected_branches": false, "custom_branch_policies": true } }
JSON
api -X POST "repos/$repo/environments/production/deployment-branch-policies" \
  -f name=main -f type=branch 2>/dev/null || echo "  (main is already allowed)"

echo "- code scanning (CodeQL default setup)"
api -X PATCH "repos/$repo/code-scanning/default-setup" --input - <<'JSON' ||
{ "state": "configured", "query_suite": "default", "languages": ["javascript-typescript", "actions"] }
JSON
  echo "  could not enable it here: turn it on under Settings > Code security"

echo "- main ruleset"
id="$(gh api "repos/$repo/rulesets" --jq '.[] | select(.name == "main") | .id')"
if [ -n "$id" ]; then
  api -X PUT "repos/$repo/rulesets/$id" --input "$root/.github/rulesets/main.json"
  echo "  updated ruleset $id"
else
  api -X POST "repos/$repo/rulesets" --input "$root/.github/rulesets/main.json"
  echo "  created"
fi

echo "Done. From now on main only changes through a pull request."
