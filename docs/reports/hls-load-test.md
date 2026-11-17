# HLS playback load test (ticket #94)

Status: not run. No measurement in this file exists yet. Every table cell marked `pending` is filled in by whoever runs the test, from the files the run produces. Nothing here is an estimate presented as a result.

Plan reference: P1 exit, risks (VPS throughput, bandwidth quota), header figures (200 viewers, about 240 Mbps), D5. Decision record: [0005](../adr/0005-signed-hls-delivered-by-nginx.md). The ladder is in [0020](../adr/0020-hls-rendition-ladder.md).

## What the test does

The k6 script `tests/load/playback.js` runs two scenarios from a machine outside the VPS network.

- `viewers`: each virtual user signs in once with its own seeded student account (`POST /api/auth/sign-in` after `GET /api/auth/csrf`), then loops over viewing sessions. A session calls `POST /api/videos/<id>/playback-session`, which sets the `hls_sig` cookie scoped to `/hls/<id>/`. The script fetches `master.m3u8`, picks one rendition by the weighted mix, fetches that rendition playlist, then fetches segments one after another. After each segment it sleeps for the segment duration minus the time the fetch took, which is real playback pace. The cookie is refreshed through `playback-session/refresh` 90 seconds before its 10 minute expiry.
- `control`: a few users send a segment request with an empty cookie jar. Every response must be 403, under the same load.

The rendition mix is in `tests/load/lib/plan.js`. It is 5% 360p, 25% 480p, 55% 720p and 15% 1080p, which averages about 1.21 Mbps with the ladder from ADR 0020 (video plus 96 Kbps audio). `packages/config/test/load-plan.test.mjs` checks the mix stays within 5% of 1.2 Mbps and that the bitrates match the worker ladder.

Thresholds set in the script: segment errors under 1%, segment latency p95 under 1000 ms, control group 403 rate exactly 100%, playback session failures under 1%. The 1000 ms latency limit is a starting value chosen for this spike, not a plan figure. Change it in the script and record the change here if the owner sets another limit.

## Preparation

1. Deploy the production stack as in [production-stack](../runbooks/production-stack.md) with one transcoded course video that has all four renditions (use a staging copy of real footage so segment sizes are realistic).
2. Seed one student account per viewer (at least 250), each with an approved enrollment in the course that holds the video. Copy `tests/load/accounts.example.json` outside the repository, fill it in and keep it out of git.
3. Sign-in and playback-session rate limits are keyed by account plus IP. All viewers share one IP, so the per-IP ceilings can block the test before the delivery path is stressed. Record the limits in force. Raise the per-IP ceilings on the test environment for the run only, or spread the ramp over more time; write down which, because a run that hit the rate limit is a rate-limit result, not a delivery result.
4. Install k6 on a machine outside the VPS network with enough bandwidth for 250 x 2.3 Mbps worst case (about 600 Mbps) or the generator becomes the bottleneck. Record its link speed and watch its own CPU during the run.

## Running

Smoke run, 10 viewers for 2 minutes (20 s ramp, 100 s hold, 20 s ramp down):

```sh
k6 run -e BASE_URL=https://<host> -e VIDEO_ID=<uuid> -e ACCOUNTS_FILE=/path/accounts.json -e PROFILE=smoke --summary-export smoke.json tests/load/playback.js
```

200 viewers for 30 minutes (5 minute ramp, 30 minute hold):

```sh
k6 run -e BASE_URL=https://<host> -e VIDEO_ID=<uuid> -e ACCOUNTS_FILE=/path/accounts.json -e PROFILE=steady --summary-export steady-1.json tests/load/playback.js
```

250 viewers, same shape:

```sh
k6 run -e BASE_URL=https://<host> -e VIDEO_ID=<uuid> -e ACCOUNTS_FILE=/path/accounts.json -e PROFILE=headroom --summary-export headroom-1.json tests/load/playback.js
```

Run the 200 viewer profile twice on different days or hours and compare, to check the result is repeatable.

## Host metrics

On the VPS, start the collector before k6 and let it run for the length of the test in minutes plus a few minutes at each end (36 minutes ramp and hold plus ramp down is about 37; use 45):

```sh
node tests/load/collect-host-metrics.mjs steady-1-host.csv <network interface> <disk device> 45
```

Find the interface with `ip route get 1.1.1.1` and the disk device name in `/proc/diskstats` (for example `vda` or `sda`, not a partition unless media lives on one). It reads `/proc/stat`, `/proc/net/dev` and `/proc/diskstats` once a minute and writes one row per minute:

| Column              | Meaning                                                                                  |
| ------------------- | ---------------------------------------------------------------------------------------- |
| `cpu_steal_percent` | Steal share of all CPU time in the minute, from the `steal` field of the `cpu` line      |
| `egress_mbps`       | Transmitted bytes on the interface in the minute, as megabits per second                 |
| `disk_latency_ms`   | Milliseconds spent on reads and writes divided by operations completed in the minute     |

Egress counts everything leaving the interface, including the Docker bridge traffic if the interface is the bridge. Use the public interface. `disk_latency_ms` is the average time per operation, not `await` queue depth; it is a mean and hides tail latency. It is 0 for a minute with no disk operations, which is expected when the page cache serves the segments, so also note whether the media working set fits in memory.

Also keep, for the report: Nginx 5xx count from the access log for the window, and the k6 generator CPU.

The collector is tested only through its parsing and arithmetic (`packages/config/test/load-plan.test.mjs`). It has not been run on a real host.

## Results

All values pending measurement.

| Run                 | Viewers | Duration | Segment requests | Segment error rate | Segment latency p95 | Control group 403 rate | Peak egress (Mbps) | Max CPU steal (%) | Max disk latency (ms) |
| ------------------- | ------- | -------- | ---------------- | ------------------ | ------------------- | ---------------------- | ------------------ | ----------------- | --------------------- |
| Smoke               | 10      | 2 min    | pending          | pending            | pending             | pending                | pending            | pending           | pending               |
| Steady, run 1       | 200     | 30 min   | pending          | pending            | pending             | pending                | pending            | pending           | pending               |
| Steady, run 2       | 200     | 30 min   | pending          | pending            | pending             | pending                | pending            | pending           | pending               |
| Headroom            | 250     | 30 min   | pending          | pending            | pending             | pending                | pending            | pending           | pending               |

Environment: VPS plan, CPU count and RAM `pending`; generator location and link speed `pending`; rate-limit settings during the run `pending`; k6 version `pending`; date `pending`.

### 1-minute series

Attach the three CSV files and plot or tabulate them. Minutes covered must equal the test length. Missing minutes `pending`.

### 250 viewer run: error rate and bottleneck

Error rate `pending`. First resource or component to saturate (CPU, steal, NIC, disk, Nginx workers, generator, rate limit) and the minute it appeared `pending`.

### Bandwidth quota

The quota is 16 TB a month. Peak egress measured in the steady run `pending` Mbps. Expected viewing pattern (viewers per day, hours each) `pending`, taken from the plan. Monthly volume is average Mbps x seconds watched x days / 8. For reference only, the helper `monthlyEgressTerabytes` in `tests/load/lib/plan.js` gives 3.24 TB for 240 Mbps held for one hour a day over 30 days; that is arithmetic, not a forecast. Projected monthly volume `pending`; share of quota `pending`.

## Decision

Pending measurement. Do not fill this section before the runs above are complete.

- Plan holds (single VPS serves signed HLS to 200 viewers with segment errors under 1%): `pending`
- 250 viewer headroom: `pending`
- Change of plan, if needed (CDN or separate video origin through the `assetKey` abstraction): `pending`
- P1 exit: `pending`
- Follow-ups for the owner, including whether ADR 0005 needs a record of the outcome: `pending`

## Limits of this test

- It is HLS playback only. API, sign-in and quiz traffic are in E15-1.
- Viewers share one IP and one network path, so it does not model many carriers.
- Viewers never seek, pause or switch rendition mid-session.
- Segment fetches are sequential per viewer with no player buffer ahead, which is slightly lighter on peak than a real player filling its buffer at start.
