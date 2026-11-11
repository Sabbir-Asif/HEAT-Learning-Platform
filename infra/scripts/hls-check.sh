#!/usr/bin/env bash
set -u

: "${HLS_SIGNING_KEYS:?set HLS_SIGNING_KEYS to the id:secret list Nginx runs with}"
: "${VIDEO_A:?set VIDEO_A to a video id that has files on disk}"
: "${VIDEO_B:?set VIDEO_B to a second video id}"
BASE_URL="${BASE_URL:-http://127.0.0.1}"
HOST_HEADER="${HOST_HEADER:-learn.localhost}"
PLAYLIST="${PLAYLIST:-index.m3u8}"
SEGMENT="${SEGMENT:-}"
RETIRED_KEY="${RETIRED_KEY:-}"

failures=0
first_key="${HLS_SIGNING_KEYS%%,*}"
first_id="${first_key%%:*}"
first_secret="${first_key#*:}"

sign() {
  printf '%s\n/hls/%s/\n%s' "$2" "$2" "$3" | openssl dgst -sha256 -hmac "$1" -hex | sed 's/^.* //'
}

cookie_for() {
  local id="$1" secret="$2" video="$3" expiry="$4"
  printf 'hls_sig=%s.%s.%s' "$id" "$expiry" "$(sign "$secret" "$video" "$expiry")"
}

status_of() {
  local path="$1" cookie="$2"
  local args=(-s -o /dev/null -w '%{http_code}' --path-as-is -H "Host: $HOST_HEADER")
  if [ -n "$cookie" ]; then args+=(-H "Cookie: $cookie"); fi
  curl "${args[@]}" "$BASE_URL$path"
}

expect() {
  local label="$1" wanted="$2" got="$3"
  if [ "$got" = "$wanted" ]; then
    printf 'PASS  %s  (%s)\n' "$label" "$got"
  else
    printf 'FAIL  %s  (wanted %s, got %s)\n' "$label" "$wanted" "$got"
    failures=$((failures + 1))
  fi
}

expect_rejected() {
  local label="$1" got="$2"
  case "$got" in
    400|403) printf 'PASS  %s  (%s)\n' "$label" "$got" ;;
    *) printf 'FAIL  %s  (wanted 400 or 403, got %s)\n' "$label" "$got"; failures=$((failures + 1)) ;;
  esac
}

expect_not_success() {
  local label="$1" got="$2"
  case "$got" in
    2??) printf 'FAIL  %s  (got %s)\n' "$label" "$got"; failures=$((failures + 1)) ;;
    *) printf 'PASS  %s  (%s)\n' "$label" "$got" ;;
  esac
}

now=$(date +%s)
future=$((now + 600))
past=$((now - 10))
cookie_a="$(cookie_for "$first_id" "$first_secret" "$VIDEO_A" "$future")"

expect "valid cookie, playlist of A" 200 "$(status_of "/hls/$VIDEO_A/$PLAYLIST" "$cookie_a")"
if [ -n "$SEGMENT" ]; then
  expect "valid cookie, segment of A" 200 "$(status_of "/hls/$VIDEO_A/$SEGMENT" "$cookie_a")"
fi

printf '\nHeaders for a valid playlist request\n'
curl -s -o /dev/null -D - -H "Host: $HOST_HEADER" -H "Cookie: $cookie_a" "$BASE_URL/hls/$VIDEO_A/$PLAYLIST" | grep -i -E '^(HTTP|content-type|cache-control|vary|x-content-type-options|content-length)'
printf '\n'

expect "cookie for A, playlist of B" 403 "$(status_of "/hls/$VIDEO_B/$PLAYLIST" "$cookie_a")"
expect "dot segments /hls/A/../B/" 403 "$(status_of "/hls/$VIDEO_A/../$VIDEO_B/$PLAYLIST" "$cookie_a")"
expect "encoded dot segments %2e%2e" 403 "$(status_of "/hls/$VIDEO_A/%2e%2e/$VIDEO_B/$PLAYLIST" "$cookie_a")"
expect "uppercase encoded dot segments %2E%2E" 403 "$(status_of "/hls/$VIDEO_A/%2E%2E/$VIDEO_B/$PLAYLIST" "$cookie_a")"
expect "encoded slash %2f" 403 "$(status_of "/hls/$VIDEO_A/..%2f$VIDEO_B/$PLAYLIST" "$cookie_a")"
expect "encoded slash before the video id" 403 "$(status_of "/hls/$VIDEO_A%2f..%2f$VIDEO_B/$PLAYLIST" "$cookie_a")"
expect "double encoding %252e" 403 "$(status_of "/hls/$VIDEO_A/%252e%252e/$VIDEO_B/$PLAYLIST" "$cookie_a")"
expect "backslash %5c" 403 "$(status_of "/hls/$VIDEO_A/..%5c$VIDEO_B/$PLAYLIST" "$cookie_a")"
expect_rejected "null byte %00" "$(status_of "/hls/$VIDEO_A/$PLAYLIST%00.jpg" "$cookie_a")"
expect "doubled slash" 403 "$(status_of "/hls/$VIDEO_A//$PLAYLIST" "$cookie_a")"

expired="$(cookie_for "$first_id" "$first_secret" "$VIDEO_A" "$past")"
expect "expired cookie" 403 "$(status_of "/hls/$VIDEO_A/$PLAYLIST" "$expired")"

last_char="${cookie_a: -1}"
if [ "$last_char" = "0" ]; then swapped=1; else swapped=0; fi
tampered="${cookie_a%?}$swapped"
expect "signature with the last character changed" 403 "$(status_of "/hls/$VIDEO_A/$PLAYLIST" "$tampered")"

expect "no cookie" 403 "$(status_of "/hls/$VIDEO_A/$PLAYLIST" "")"
expect "garbage cookie" 403 "$(status_of "/hls/$VIDEO_A/$PLAYLIST" "hls_sig=garbage")"
unknown="$(cookie_for "nokey" "$first_secret" "$VIDEO_A" "$future")"
expect "unknown key id" 403 "$(status_of "/hls/$VIDEO_A/$PLAYLIST" "$unknown")"

IFS=',' read -r -a entries <<< "$HLS_SIGNING_KEYS"
for entry in "${entries[@]}"; do
  id="${entry%%:*}"
  secret="${entry#*:}"
  signed="$(cookie_for "$id" "$secret" "$VIDEO_A" "$future")"
  expect "active key $id accepted" 200 "$(status_of "/hls/$VIDEO_A/$PLAYLIST" "$signed")"
done

if [ -n "$RETIRED_KEY" ]; then
  retired_id="${RETIRED_KEY%%:*}"
  retired_secret="${RETIRED_KEY#*:}"
  retired="$(cookie_for "$retired_id" "$retired_secret" "$VIDEO_A" "$future")"
  expect "retired key $retired_id rejected" 403 "$(status_of "/hls/$VIDEO_A/$PLAYLIST" "$retired")"
fi

expect_not_success "original upload path /originals/" "$(status_of "/originals/$VIDEO_A.mp4" "$cookie_a")"
expect_not_success "original upload path /media/originals/" "$(status_of "/media/originals/$VIDEO_A.mp4" "$cookie_a")"
expect_not_success "original path through /hls/" "$(status_of "/hls/originals/$VIDEO_A.mp4" "$cookie_a")"

printf '\n%s failure(s)\n' "$failures"
[ "$failures" -eq 0 ]
