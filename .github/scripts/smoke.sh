#!/usr/bin/env bash
# Post-deploy smoke test against production. Usage: smoke.sh web|api
# Retries for about a minute, because a new Worker version takes a moment to be served everywhere.
set -euo pipefail

target="${1:?usage: smoke.sh web|api}"
web="https://matrstudio.com"
api="https://api.matrstudio.com"

status() {
  curl -sS -o /dev/null -w '%{http_code}' --max-time 15 "$1" || echo 000
}

# expect NAME URL STATUS: retries until the URL answers with STATUS.
expect() {
  local name="$1" url="$2" want="$3" got=""
  for attempt in 1 2 3 4 5 6; do
    got="$(status "$url")"
    if [ "$got" = "$want" ]; then
      echo "ok    $name ($url -> $got)"
      return 0
    fi
    echo "wait  $name: got $got, want $want (attempt $attempt)"
    sleep 10
  done
  echo "FAIL  $name: $url answered $got, expected $want" >&2
  return 1
}

# header NAME URL HEADER: the response must carry the header.
header() {
  local name="$1" url="$2" wanted="$3"
  if curl -sSI --max-time 15 "$url" | grep -qi "^$wanted:"; then
    echo "ok    $name ($wanted present)"
  else
    echo "FAIL  $name: $url has no $wanted header" >&2
    return 1
  fi
}

case "$target" in
  api)
    expect "API health" "$api/health" 200
    expect "API refuses signed-out requests" "$api/api/me" 401
    ;;
  web)
    expect "Home page" "$web/" 200
    expect "Sign-in page" "$web/sign-in" 200
    expect "Unknown page is a 404" "$web/this-page-does-not-exist" 404
    expect "www redirects to the apex" "https://www.matrstudio.com/" 301
    # /api/* on the site goes through the service binding to the API Worker.
    expect "Site reaches the API" "$web/api/me" 401
    header "Security headers" "$web/" content-security-policy
    ;;
  *)
    echo "usage: smoke.sh web|api" >&2
    exit 1
    ;;
esac
