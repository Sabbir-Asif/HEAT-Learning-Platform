# 0020. HLS rendition ladder and FFmpeg flags

- Status: Proposed (one of Proposed, Accepted, Superseded by NNNN)
- Date: 2026-11-11
- Plan: [D5, section 02 Design decisions](../plan/heat-lms-project-plan.html#decisions), Critical flows (rendition table)

## Context

Video delivery is the part the single VPS is most likely to struggle with. Ticket #92 asks for a ladder tuned on real course footage on the target VPS, so that the transcode job (E8-7) implements one agreed FFmpeg command.

Nothing in this record has been measured. The machine this was written on has no FFmpeg, no course footage and no access to the VPS. What exists is the ladder as tested code, two scripts to run it, and the plan to measure it. The bitrates below are the plan's starting targets, not tuned values. Every acceptance criterion that needs footage, the VPS or a person is still open, and this record stays Proposed until the owner fills in the measurements and accepts it.

## Decision

The starting ladder, implemented in `apps/worker/src/transcode/ladder.ts`:

| Rendition | Video bitrate | Maxrate | Bufsize | Audio  | Plan size per 10 min |
| --------- | ------------- | ------- | ------- | ------ | -------------------- |
| 360p      | 400 Kbps      | 428k    | 800k    | 96 Kbps AAC | 30 MB           |
| 480p      | 650 Kbps      | 696k    | 1300k   | 96 Kbps AAC | 49 MB           |
| 720p      | 1100 Kbps     | 1177k   | 2200k   | 96 Kbps AAC | 90 MB           |
| 1080p     | 2200 Kbps     | 2354k   | 4400k   | 96 Kbps AAC | 188 MB          |

- 720p uses 1100 Kbps, inside the plan's 1.0 to 1.2 Mbps. 1080p uses 2200 Kbps, inside 2.0 to 2.5 Mbps. The plan's 90 MB and 188 MB estimates correspond to the upper ends (1.2 and 2.5 Mbps), so the measured sizes at these values should come in lower.
- No upscaling. A source gets the renditions whose height is at or below its own: 720p gives 360p, 480p and 720p; a source taller than 1080p is capped at 1080p. A source below 360p gets one rendition at its own height (rounded down to an even number) at the 360p bitrate, so a very small upload still plays.
- Segments are about 6 seconds, format MPEG-TS (`-hls_segment_type mpegts`), VOD playlists with `-hls_flags independent_segments`.
- Keyframes align across renditions because every rendition uses the same frame rate and the same rules: `-r <fps>`, `-g` and `-keyint_min` equal to fps times 6, `-sc_threshold 0`, and `-force_key_frames expr:gte(t,n_forced*6)`. The frame rate comes from ffprobe and is capped at 30.
- One FFmpeg process per rendition, each started with `nice -n 19`, renditions run one after another (concurrency 1). The master playlist is written by our code and lists only the renditions that were produced.

The command per rendition (arguments are passed as an array, never through a shell):

```
nice -n 19 ffmpeg -nostdin -y -i <input> -map 0:v:0 -map 0:a:0?
  -vf scale=-2:<height> -r <fps>
  -c:v libx264 -preset veryfast -profile:v high -level 4.0 -pix_fmt yuv420p
  -b:v <kbps>k -maxrate <1.07 x kbps>k -bufsize <2 x kbps>k
  -g <fps x 6> -keyint_min <fps x 6> -sc_threshold 0
  -force_key_frames expr:gte(t,n_forced*6)
  -c:a aac -b:a 96k -ac 2 -ar 48000
  -f hls -hls_time 6 -hls_playlist_type vod -hls_flags independent_segments
  -hls_segment_type mpegts
  -hls_segment_filename <out>/<rendition>/segment_%05d.ts <out>/<rendition>/index.m3u8
```

The master playlist declares `BANDWIDTH` as video plus audio bitrate, `RESOLUTION` and `CODECS="avc1.640028,mp4a.40.2"` for every rung.

What the unit tests prove without FFmpeg: the ladder values, rendition selection (1080p gives four, 720p gives three with no 1080p, taller than 1080p is capped, below 360p gives one), identical keyframe and segment arguments across renditions, the master playlist listing only the renditions given, and the rules the verification script applies to ffprobe output.

## Consequences

- E8-7 starts from `ladder.ts` and the verification rules in `ladder-verify.ts`, once the measurements are in and the owner accepts the values.
- The master playlist `RESOLUTION` assumes 16:9. A source with another aspect ratio is scaled with `scale=-2:<height>` so the real width differs from the declared one. E8-7 should compute the width from the probed source.
- One FFmpeg process per rendition decodes the source four times. This keeps each command simple and each rendition restartable. If measured encode time is too high, a single process with a split filter graph is the alternative to test.
- `-preset veryfast` is a guess that favours VPS cost over file size. The measurement may move it.

## Alternatives considered

- A single FFmpeg process producing every rendition with `-var_stream_map` and `-master_pl_name`. Not chosen for the starting point because the decode is shared but a failure loses every rendition; to be compared on the VPS. Derived from the rationale, not named in the plan.
- fMP4 (CMAF) segments. Not chosen: the plan asks for no particular format, MPEG-TS plays in hls.js and Safari, and fMP4 can be tried if size matters. Derived from the rationale, not named in the plan.

## Measurements: pending

Nothing below has been measured. Do not read any value here as a result until a row is filled in with the date and the machine.

Footage: two pieces supplied by the department, one talking head and one scene with motion, at least 10 minutes each, ideally 1080p.

Commands, run on the target VPS from the repository root after `pnpm --filter worker build`:

```
/usr/bin/time -v node apps/worker/bin/encode-ladder.mjs <input.mp4> <outputDir>
node apps/worker/bin/verify-ladder.mjs <outputDir>
```

`encode-ladder.mjs` prints wall seconds and megabytes per rendition. `/usr/bin/time -v` reports total CPU time and peak memory. Scale encode time to 10 minutes of source if the footage is longer or shorter. Repeat once with a 720p copy of the source (`ffmpeg -i <input.mp4> -vf scale=-2:720 -c:a copy <input-720p.mp4>`) to confirm no 1080p rendition is produced. Open `master.m3u8` in hls.js and in Safari, and switch qualities mid-stream.

| Footage      | Rendition | Encode wall time per 10 min | CPU time per 10 min | Size per 10 min | Plan estimate | Result |
| ------------ | --------- | --------------------------- | ------------------- | --------------- | ------------- | ------ |
| Talking head | 360p      | pending                     | pending             | pending         | 30 MB         | pending |
| Talking head | 480p      | pending                     | pending             | pending         | 49 MB         | pending |
| Talking head | 720p      | pending                     | pending             | pending         | 90 MB         | pending |
| Talking head | 1080p     | pending                     | pending             | pending         | 188 MB        | pending |
| Motion       | 360p      | pending                     | pending             | pending         | 30 MB         | pending |
| Motion       | 480p      | pending                     | pending             | pending         | 49 MB         | pending |
| Motion       | 720p      | pending                     | pending             | pending         | 90 MB         | pending |
| Motion       | 1080p     | pending                     | pending             | pending         | 188 MB        | pending |

| Check                                                           | Result  |
| --------------------------------------------------------------- | ------- |
| `verify-ladder.mjs` passes on the 1080p source (keyframes, 6 s segments, codecs) | pending |
| 720p source produces no 1080p and the master lists three renditions | pending |
| Master plays in hls.js and in Safari, quality switch is clean   | pending |
| 480p and 720p readable on a phone (text and faces), owner or department | pending |
| Side-by-side on a laptop                                        | pending |

If the visual review finds 480p or 720p unreadable, raise those bitrates, record the new values in the Decision table and change `LADDER` in `ladder.ts` with its test.

## Open points for the owner

- Every acceptance criterion except the ones proven by unit tests is open: playback in hls.js and Safari, keyframe alignment and segment length on real output, encode time and size on the VPS against the plan estimates, and the phone readability review. They need footage, the VPS and a person, none of which were available. Proposed resolution: the owner runs the commands above, fills the tables, then accepts or adjusts this record.
- Segment format (MPEG-TS) and the single-process alternative are untested choices. Proposed: keep MPEG-TS and one process per rendition unless the measurements argue otherwise.
