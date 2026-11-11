#!/usr/bin/env bash
set -u

BASE_URL="${BASE_URL:-http://127.0.0.1}"
KEY="${KEY:-$(printf 'a%.0s' $(seq 1 64)).pdf}"
HOSTS="${HOSTS:-learn.localhost admin.localhost}"

failures=0

status_of() {
  curl -s -o /dev/null -w '%{http_code}' --path-as-is -H "Host: $1" "$BASE_URL$2"
}

expect() {
  if [ "$3" = "$2" ]; then
    printf 'PASS  %s  (%s)\n' "$1" "$3"
  else
    printf 'FAIL  %s  (wanted %s, got %s)\n' "$1" "$2" "$3"
    failures=$((failures + 1))
  fi
}

expect_not_success() {
  case "$3" in
    2??) printf 'FAIL  %s  (got %s)\n' "$1" "$3"; failures=$((failures + 1)) ;;
    *) printf 'PASS  %s  (%s)\n' "$1" "$3" ;;
  esac
}

for host in $HOSTS; do
  expect "$host direct internal file" 404 "$(status_of "$host" "/internal/certificates/$KEY")"
  expect "$host internal directory" 404 "$(status_of "$host" "/internal/certificates/")"
  expect_not_success "$host traversal out of the internal location" - "$(status_of "$host" "/internal/certificates/../../etc/passwd")"
  expect_not_success "$host encoded traversal" - "$(status_of "$host" "/internal/certificates/%2e%2e/%2e%2e/etc/passwd")"
done

printf '\n%s failure(s)\n' "$failures"
[ "$failures" -eq 0 ]
