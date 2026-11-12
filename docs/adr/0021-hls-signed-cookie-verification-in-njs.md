# 0021. HLS signed-cookie format and njs verification

- Status: Proposed
- Date: 2026-11-11
- Plan: [D5, section 02 Design decisions](../plan/heat-lms-project-plan.html#decisions), Security and quality bar (Nginx signed-link checks)

## Context

[0005](0005-signed-hls-delivered-by-nginx.md) decided that the API authorizes playback with a short-lived signed cookie and that Nginx verifies it with njs, without the database or Node. Ticket #93 asks for the exact format, the verification code and the proof on the real VPS, so that E8-9 and E8-4 can reuse it.

This record covers what was built and exercised on a developer machine: unit tests for the verification rules, and a throwaway `nginx:1.29-alpine` container (nginx 1.29.8 with its bundled njs) driven by the curl script. Nothing was run on the VPS, and the browser path with hls.js was not built. Those parts are listed under Pending and keep this record Proposed.

## Decision

Cookie `hls_sig`, value `<keyId>.<expiry>.<signature>`:

- `keyId`: 1 to 32 characters of `A-Z a-z 0-9 _ -`. Names the signing key.
- `expiry`: Unix seconds, 1 to 10 digits. The cookie is valid while `expiry` is greater than the current time. The API sets it to issue time plus 600 seconds.
- `signature`: lowercase hex HMAC-SHA256, 64 characters.

Signing input, three lines joined by line feeds: `<videoId>`, `/hls/<videoId>/`, `<expiry>`. The video id is 1 to 64 characters of `A-Z a-z 0-9 _ -`. Binding the id and the prefix into the signature means a cookie copied to another video's path does not verify, even if a client sends it by hand.

Cookie attributes set by the API: `Path=/hls/<videoId>/`, `HttpOnly`, `Secure`, `SameSite=Strict`, `Max-Age=600`. The response body carries only `expiresAt`. The player refreshes before expiry as described in 0005.

Issuing endpoint (spike quality): `POST /api/admin/playback-sessions/:videoId`, admin audience, roles ADMIN and SUPER_ADMIN, rate-limit profile `playbackSession`, CSRF checked like every unsafe method. It does not check that the video exists or is READY. Student playback, enrollment and module-lock rules belong to E8-9.

Verification in Nginx (`infra/nginx/hls-verify.js`, entry `infra/nginx/hls.js`, location in `infra/nginx/hls.inc`), in this order:

1. Normalise the raw `$request_uri` path, never the already-decoded `$uri`. The request is refused, with no attempt to repair it, when the path has a backslash or a control character, an encoded slash (`%2f`), encoded backslash (`%5c`) or encoded NUL (`%00`), an invalid or non-ASCII percent sequence, a `%` left after one round of decoding (double encoding), a `.` or `..` segment after decoding, or an empty segment other than the trailing one. Refusing instead of normalising means the string that is verified is the string Nginx maps to a file.
2. The path must start with `/hls/<videoId>/`. The video id comes from the path.
3. Exactly one `hls_sig` cookie, with the format above. A duplicate or malformed cookie is refused.
4. The key id must be an own entry of the configured key list. Otherwise refused.
5. Recompute the HMAC with that key and compare with a manual constant-time comparison: it always walks the longer of the two strings and ORs the differences, because njs has no `timingSafeEqual`.
6. Refuse when `expiry` is not in the future.

Any refusal returns 403 with no body detail. The reason (`bad-path`, `no-cookie`, `malformed`, `unknown-key`, `bad-signature`, `expired`) goes only to the Nginx error log through `r.warn`, with no cookie value, id or address. Nginx itself answers 400 to a raw NUL byte before njs runs; the curl script accepts 400 or 403 for that case.

Key rotation: `HLS_SIGNING_KEYS` is a comma separated list of `id:secret` (secrets at least 32 characters). Nginx accepts every key in the list. The API signs with `HLS_ACTIVE_KEY_ID`, or the first key when it is unset. To rotate: add the new key to Nginx and reload, make it the API's active key, wait at least 10 minutes for old cookies to expire, remove the old key and reload Nginx. A cookie signed with a retired key is refused as `unknown-key`. Keys live in environment variables only: the API reads them through its validated config, Nginx through `env HLS_SIGNING_KEYS;` in `infra/nginx/nginx.conf`. The values in the two `.env.example` files are development-only.

Serving: `root /srv/media`, so `/hls/<id>/...` maps to `/srv/media/hls/<id>/...`, with `sendfile on`, GET and HEAD only, no directory listing, and `types` for `.m3u8` (`application/vnd.apple.mpegurl`), `.ts` (`video/mp2t`), `.m4s` (`video/iso.segment`) and `.mp4`. Responses carry `Vary: Cookie`, `X-Content-Type-Options: nosniff` and `Cache-Control: private, no-store` for playlists or `private, max-age=600` for segments, so a shared cache never stores them and a browser keeps a segment no longer than the cookie lives. Originals are never mounted into the Nginx container and are not under `/srv/media`.

njs limits found by running the code in the real module: only a default import and a single default export per file, no `for...of`, no destructured parameters. `hls-verify.js` therefore exports one object and uses indexed loops, and a test in `packages/config` guards the syntax. The pure logic is tested under Node in `packages/config/test/hls-verify.test.mjs` and `hls-handler.test.mjs`; the API signer shares one pinned test vector with them.

## Consequences

- E8-9 can reuse the cookie format, the verifier and the location unchanged. It adds the rules in front of the issuing call and a student route that sets the same cookie.
- Revocation takes effect at expiry, at most 10 minutes, as 0005 states. A cached segment can still play for up to its `max-age`, which is also at most 10 minutes.
- Keys are read from the environment on every request in njs, but Nginx workers receive the environment only at start, so a rotation needs an Nginx reload.
- The verifier refuses ambiguous paths instead of normalising them. A client that sends an encoded `.` or a doubled slash in a segment URI gets 403, so playlists must use plain relative names.
- HMAC is computed on every segment request. This costs CPU in the Nginx worker and is part of the load test in E8-3.
- The issuing endpoint returns 503 when no key is configured and does not require keys in production config yet. E8-9 should make them required.

## Alternatives considered

- `auth_request` to the API on every segment. Rejected: it puts the API on the segment path, against 0005.
- A signed query string on each segment URL. Not chosen: playlists would need rewriting per user, and the cookie scoped by path covers every file of a video with no rewrite. Derived, not named in the plan.
- Normalising the path and verifying the result. Not chosen: a normalisation difference between njs and Nginx is exactly the gap an attacker looks for; refusing removes it.
- Base64url for the signature. Not chosen: hex is easier to compare and check with `openssl` in the curl script. Derived, not named in the plan.

## Pending: not run on the real VPS

None of the following has been done. Do not read any of it as a result.

- Running the curl script against the VPS Nginx with real HLS output from the E8-7 job. Run from a machine that can reach the VPS, with the same key list Nginx runs with:

```
HLS_SIGNING_KEYS='<id:secret,id:secret>' VIDEO_A=<id with files> VIDEO_B=<another id> BASE_URL=https://<host> HOST_HEADER=<host> SEGMENT=<rendition>/segment_00000.ts infra/scripts/hls-check.sh
```

- The key rotation case on the VPS: set `RETIRED_KEY='<id:secret>'` after removing that key from Nginx and reloading, and confirm it prints a passing 403 row.
- Confirming that the API receives no request for a playlist or segment: compare the API access log count before and after a playback, or watch Nginx's upstream log. Locally the API was not running at all and the 200 responses still came from Nginx, but that is not a VPS measurement.
- A hls.js page playing a video through the signed path. Not built: no frontend depends on hls.js yet, and playback is #105. The browser behaviours still unproven are that `Secure` cookies are accepted and sent on the admin and learner hosts in development over plain HTTP, that `SameSite=Strict` is sent for media requests made by hls.js, and that range requests on `.ts` segments work through the cookie check.
- CPU cost of the HMAC under many concurrent viewers (E8-3).
- The integration test for these criteria is #215.

## Open points for the owner

- The cookie does not carry a user or session identifier, so a leaked cookie works for anyone until expiry. Proposed: keep it, since the lifetime is 10 minutes, and revisit only if the threat model asks for per-user binding.
- Required keys in production configuration. Proposed: E8-9 adds the requirement together with the student endpoint.
