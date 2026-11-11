#!/usr/bin/env bash
# Decides which Workers a deploy run ships: whatever changed since the last release tag.
#
# Outputs (to $GITHUB_OUTPUT, or stdout when run by hand): web, backend, base.
# Needs full history and tags. DISPATCH_TARGET (auto|web|backend|both) comes from the manual run.
#
# The base is the last release tag, not the previous commit: a tag is only written after a fully
# successful deploy, so a run that failed halfway is retried by the next one.
set -euo pipefail

out="${GITHUB_OUTPUT:-/dev/stdout}"
target="${DISPATCH_TARGET:-auto}"
base="$(git tag --list 'release-*' --merged HEAD --sort=-creatordate | head -n 1 || true)"

web=false
backend=false

affected() {
  pnpm --silent turbo query affected --packages "$1" --base "$base" --head HEAD 2>/dev/null |
    node -e 'let s="";process.stdin.on("data",(d)=>{s+=d}).on("end",()=>{console.log(JSON.parse(s).data.affectedPackages.length)})'
}

case "$target" in
  web) web=true ;;
  backend) backend=true ;;
  both)
    web=true
    backend=true
    ;;
  auto)
    if [ -z "$base" ]; then
      echo "No release tag yet: deploying everything."
      web=true
      backend=true
    elif ! git diff --quiet "$base" HEAD -- .github/workflows .github/scripts; then
      echo "The pipeline itself changed: deploying everything."
      web=true
      backend=true
    else
      if [ "$(affected @matr/web)" -gt 0 ]; then web=true; fi
      if [ "$(affected @matr/backend)" -gt 0 ]; then backend=true; fi
    fi
    ;;
  *)
    echo "Unknown target: $target" >&2
    exit 1
    ;;
esac

echo "Since ${base:-the beginning}: web=$web backend=$backend"
{
  echo "web=$web"
  echo "backend=$backend"
  echo "base=$base"
} >>"$out"
