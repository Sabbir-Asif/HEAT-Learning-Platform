# Learning Management System (LMS) --- Production Implementation Plan

## 1. Project objective

Build a web-based learning platform where students enroll in courses,
watch required videos, pass module quizzes, unlock subsequent modules,
complete courses, and download certificates.

### Initial capacity targets

-   Up to 10,000 enrolled students.
-   Approximately 200 concurrent students watching different videos.
-   10 videos per course, approximately 10 minutes each (100 minutes
    total).
-   HLS video delivery with adaptive and manual quality selection.
-   Resume playback and reliable progress tracking.
-   Administrator-managed courses, modules, videos, quizzes, and passing
    thresholds.

**Capacity note:** These are design targets, not guaranteed capacity.
Validate the selected VPS with realistic load tests before production
launch.

------------------------------------------------------------------------

## 2. Recommended architecture

Use a **NestJS modular monolith** initially. Keep video delivery
separate from application business logic. Do not proxy video segment
bytes through NestJS.

``` text
                         STUDENT / ADMIN
                    Next.js + React + hls.js
                              |
                         HTTPS requests
                              |
                    APPLICATION LAYER
                         NestJS API
             +----------------+----------------+
             |                |                |
        PostgreSQL         Redis           Playback
        (durable data)   (queues/cache)   authorization
             |                |
             |             BullMQ
             |                |
             |          Background worker
             |                |
             |              FFmpeg
             |                |
             +----------------+----------------+
                              |
                       VIDEO DELIVERY
                           Nginx
                              |
                   HLS playlists and segments
                              |
                       NVMe video storage
                              |
                    Directly to student browser
```

For the first deployment, these components can run in separate Docker
containers on one VPS. This is cost-effective but is not high
availability: a VPS outage affects the whole platform.

### Technology stack

  -----------------------------------------------------------------------
  Layer                   Recommended technology  Responsibility
  ----------------------- ----------------------- -----------------------
  Frontend                Next.js, React,         Student and admin
                          TypeScript              interfaces

  Video player            hls.js, native HLS      Adaptive video playback
                          where supported         

  Backend                 NestJS, TypeScript      Business logic and APIs

  Database                PostgreSQL, Prisma      Durable application
                                                  data

  Queue/cache             Redis, BullMQ           Background jobs and
                                                  selected caching

  Transcoding             FFmpeg                  Generate HLS renditions

  Video origin            Nginx                   Static HLS delivery

  Infrastructure          Ubuntu 24.04, Docker    Initial deployment
                          Compose                 

  Monitoring              Prometheus, Grafana,    Metrics, dashboards,
                          Sentry                  error reporting
  -----------------------------------------------------------------------

Do not introduce microservices, Kubernetes, or Kafka at this stage. Add
infrastructure only when measured bottlenecks justify it.

------------------------------------------------------------------------

## 3. Video streaming design

### 3.1 Use HLS

Store the uploaded original video privately and generate HLS renditions
asynchronously.

For each source video, generate:

-   360p --- initial target around 400 Kbps
-   480p --- initial target around 650 Kbps
-   720p --- initial target around 1.0--1.2 Mbps
-   1080p --- initial target around 2.0--2.5 Mbps

These are starting bitrate targets, not universal quality guarantees.
Test the output using actual course material, especially screen
recordings, presentations, and text-heavy content.

Recommended encoding characteristics:

-   H.264 video and AAC audio for broad compatibility.
-   HLS VOD playlists.
-   Approximately 6-second segments.
-   Aligned keyframes and segment boundaries across renditions.
-   A master playlist referencing all available quality levels.
-   Validate generated playlists and segments before marking a video
    ready.

Example directory layout:

``` text
/srv/lms/videos/
├── originals/
│   ├── video-001.mp4
│   └── video-002.mp4
├── hls/
│   ├── video-001/
│   │   ├── master.m3u8
│   │   ├── 360p/
│   │   ├── 480p/
│   │   ├── 720p/
│   │   └── 1080p/
│   └── video-002/
└── temporary/
```

Keep original uploads private. Students should receive access to the HLS
output only after backend authorization.

### 3.2 Transcoding workflow

Do not run FFmpeg synchronously inside an upload HTTP request.

1.  Admin uploads a video.
2.  Backend stores the original file and creates a video record.
3.  Backend adds a transcoding job to BullMQ.
4.  A worker runs FFmpeg and generates HLS output.
5.  Worker validates the output.
6.  Video status changes to `READY`, or to `FAILED` with an error
    record.

Suggested video processing states:

``` text
UPLOADED -> QUEUED -> PROCESSING -> READY
                                  \-> FAILED
```

Jobs must be retryable and idempotent. A retry should not mix partial
output with a previous attempt.

On a 4-vCPU production VPS, restrict FFmpeg CPU usage and schedule large
transcodes during off-peak hours. Prefer a separate transcoding worker
if upload/transcoding activity begins affecting playback.

### 3.3 Player behaviour

Use hls.js where browser support requires it and native HLS where
supported.

The player should provide:

-   Auto quality selection (default).
-   Manual 360p, 480p, 720p, and 1080p selection when available.
-   Full-screen playback.
-   Playback speed.
-   Resume playback.
-   Buffering and error indicators.
-   Controlled retry/recovery for transient playback errors.

Do not preload entire videos. Load playlists and a bounded segment
buffer, then request further segments as playback proceeds.

### 3.4 Video access security

Playback flow:

1.  Browser requests a playback session from NestJS.
2.  API verifies authentication, enrollment, and module/video access.
3.  API issues short-lived playback authorization.
4.  Browser requests the master playlist and HLS segments from Nginx.
5.  Nginx validates authorization for playlists and every segment.

Use signed cookies or an equivalent signed-path/token mechanism that
covers the complete HLS asset path. Avoid a design where only the master
playlist is protected but its segments are public.

Do not query PostgreSQL for every segment request. Validate signed
access at the video origin or use a carefully cached authorization
mechanism.

Also:

-   Use HTTPS.
-   Keep original uploads outside the public web root.
-   Never treat `Referer` as an authorization mechanism.
-   Rate-limit playback-session creation.
-   Log suspicious access patterns.
-   Understand that signed HLS access is not DRM and cannot prevent
    screen recording.

------------------------------------------------------------------------

## 4. Storage and bandwidth estimates

### 4.1 Video storage

For 10 videos of 10 minutes each, total duration is 100 minutes.

Approximate HLS storage for all 10 videos:

  Rendition     Approximate bitrate   Approximate storage
  ----------- --------------------- ---------------------
  360p                     400 Kbps                300 MB
  480p                     650 Kbps                488 MB
  720p                     1.2 Mbps                900 MB
  1080p                    2.5 Mbps              1.875 GB
  **Total**                                   **3.56 GB**

Allow additional space for original uploads, temporary transcoding
files, playlists, logs, and operational headroom. A reasonable initial
budget for this library is approximately 5--8 GB, depending on source
files and encoding.

The proposed 200 GB NVMe disk is ample for this initial library.
Recalculate storage as the number and duration of courses grow.

### 4.2 Concurrent bandwidth

Approximate outbound video payload bandwidth for 200 simultaneous
viewers:

  Average bitrate per viewer     Aggregate video bandwidth
  ---------------------------- ---------------------------
  400 Kbps                                         80 Mbps
  650 Kbps                                        130 Mbps
  1 Mbps                                          200 Mbps
  1.5 Mbps                                        300 Mbps
  2.5 Mbps                                        500 Mbps

Plan around 200--300 Mbps for a 1--1.5 Mbps average bitrate, while
leaving headroom for bursts and network overhead. A 1 Gbps advertised
port does not guarantee sustained throughput; test actual performance.

### 4.3 Monthly bandwidth

Each student watching 100 minutes once consumes approximately:

  Average bitrate     Approximate data per student   10,000 students
  ----------------- ------------------------------ -----------------
  1 Mbps                                    750 MB            7.5 TB
  1.5 Mbps                                1.125 GB          11.25 TB
  2 Mbps                                    1.5 GB             15 TB

These figures exclude replays and other traffic. Total lifetime course
consumption is not the same as monthly usage; the monthly total depends
on how quickly students complete the course.

The proposed 16 TB monthly allowance is plausible for the expected
usage, but monitor it closely. Verify the provider's current bandwidth
policy and throttling terms before purchase. Keep a safety margin rather
than planning to consume the full allowance.

------------------------------------------------------------------------

## 5. Database design

Use PostgreSQL as the source of truth for enrollments, quiz attempts,
module unlocks, and student progress.

### Core entities

  -----------------------------------------------------------------------
  Table                               Important fields / purpose
  ----------------------------------- -----------------------------------
  `users`                             id, name, email, passwordHash, role

  `courses`                           id, title, description, status,
                                      version

  `course_enrollments`                id, userId, courseId, enrolledAt,
                                      status

  `modules`                           id, courseId, title, order,
                                      passMark, isPublished

  `videos`                            id, moduleId, title, assetKey,
                                      duration, order, isRequired,
                                      processingStatus

  `video_progress`                    enrollmentId, videoId,
                                      lastPosition, watchedSeconds,
                                      completion state

  `quizzes`                           id, moduleId, title,
                                      attemptsAllowed

  `quiz_questions`                    id, quizId, question, points

  `quiz_options`                      id, questionId, text, isCorrect

  `quiz_attempts`                     id, enrollmentId, quizId, score,
                                      passMarkSnapshot, passed,
                                      submittedAt

  `quiz_answers`                      attemptId, questionId,
                                      selectedOptionId

  `module_progress`                   enrollmentId, moduleId, status,
                                      unlockedAt, completedAt

  `certificates`                      id, enrollmentId,
                                      certificateNumber, issuedAt,
                                      fileKey
  -----------------------------------------------------------------------

### Important constraints and indexes

-   Unique `(userId, courseId)` on `course_enrollments`.
-   Unique `(enrollmentId, videoId)` on `video_progress`.
-   Unique `(enrollmentId, moduleId)` on `module_progress`.
-   Unique certificate per enrollment/course completion.
-   Unique module order within a course.
-   Unique video order within a module.
-   Index foreign keys and common filters, especially enrollment IDs,
    course IDs, module IDs, and processing statuses.

Use consistent IDs (UUID or CUID). Store a stable `assetKey` rather than
hard-coding a physical disk path into business logic.

Keep `video_progress` and `module_progress` separate: - Video progress
records playback state and watched coverage. - Module progress records
learning workflow state: locked, unlocked, in progress, or completed.

For published course changes, define a versioning policy. Avoid silently
reordering modules or invalidating existing student completion records.

------------------------------------------------------------------------

## 6. Progress tracking and resume playback

The browser should periodically send progress updates, approximately
every 15--30 seconds, and also on pause, page visibility changes, and
video completion.

Example request:

``` json
{
  "videoId": "video-id",
  "sessionId": "playback-session-id",
  "currentPosition": 245,
  "playbackRate": 1
}
```

Backend must verify: - Student authentication. - Enrollment. - Access to
the module and video. - Playback session validity. - Reasonable progress
timing and progression.

Keep resume position separate from watched coverage.

Do not trust `currentTime` or a client-reported completion percentage as
proof that a video was watched. A student can seek to the end. For
stronger completion checks, record qualifying watched intervals, merge
overlapping intervals on the backend, and calculate coverage from those
intervals. Validate heartbeat timing and playback progression. This
deters simple seeking but is not foolproof against a determined user.

Use idempotent writes and prevent stale browser requests from
overwriting a newer saved position. Begin with direct batched PostgreSQL
writes; introduce Redis buffering only if load testing demonstrates a
need.

------------------------------------------------------------------------

## 7. Quiz, module unlocking, and course completion

A module is complete only when:

1.  All required videos satisfy the configured completion criteria.
2.  The student submits the module quiz.
3.  The backend calculates the score.
4.  The score meets or exceeds the module's passing threshold.

Example:

``` text
Configured pass mark: 70%
Student score:        85%
Result:               PASSED
```

On successful completion, perform the state transition transactionally:

1.  Save the quiz attempt.
2.  Mark the current module completed.
3.  Unlock the next published module.
4.  If no module remains, check course completion.
5.  If the course is complete, enqueue certificate generation.

Backend rules:

-   Calculate quiz scores on the server.
-   Never expose correct answers before submission.
-   Record failed attempts.
-   Enforce configured attempt limits.
-   Store `passMarkSnapshot` on each attempt so later admin changes do
    not rewrite history.
-   Make completion and unlocking operations idempotent.
-   Define how retakes and changes to published course content affect
    existing learners.

------------------------------------------------------------------------

## 8. Backend module structure

Recommended NestJS modular monolith:

``` text
src/
├── common/
│   ├── decorators/
│   ├── guards/
│   ├── filters/
│   ├── interceptors/
│   └── utilities/
├── config/
├── modules/
│   ├── authentication/
│   ├── users/
│   ├── courses/
│   ├── enrollments/
│   ├── learning-modules/
│   ├── videos/
│   ├── video-progress/
│   ├── playback/
│   ├── quizzes/
│   ├── quiz-attempts/
│   ├── module-progress/
│   ├── certificates/
│   └── admin/
├── infrastructure/
│   ├── database/
│   ├── redis/
│   ├── queues/
│   ├── storage/
│   └── video-processing/
└── main.ts
```

Keep controllers thin and put business rules in services. Define clear
module boundaries and avoid circular dependencies.

### Suggested API surface

  ---------------------------------------------------------------------------------
  Method                  Endpoint                          Purpose
  ----------------------- --------------------------------- -----------------------
  POST                    `/courses`                        Create course

  GET                     `/courses`                        List courses

  POST                    `/courses/:id/enroll`             Enroll student

  GET                     `/courses/:id/learning`           Get learning structure
                                                            and access state

  POST                    `/videos/upload`                  Upload video

  GET                     `/videos/:id/processing-status`   Check transcoding
                                                            status

  POST                    `/videos/:id/playback-session`    Authorize playback

  POST                    `/videos/:id/progress`            Update playback
                                                            progress

  GET                     `/modules/:id/quiz`               Get quiz questions

  POST                    `/quizzes/:id/attempts`           Submit quiz

  GET                     `/courses/:id/progress`           Get course progress

  GET                     `/certificates/:id`               Download certificate

  GET                     `/certificates/verify/:number`    Verify certificate
  ---------------------------------------------------------------------------------

Apply DTO validation, authentication and authorization guards, and
appropriate rate limits.

------------------------------------------------------------------------

## 9. Frontend experience

### Student dashboard

Show: - Enrolled courses. - Course completion percentage. - Current
module. - Completed, unlocked, and locked modules. - Certificate
availability.

### Course learning page

Use a two-column layout: - Main area: video player, title, description,
and learning content. - Side area: module list, video list, completion
indicators, and quiz access.

The player should offer Auto quality by default, manual quality
selection, playback speed, full-screen, resume playback, and clear
loading/error states.

### Frontend state management

  Concern          Recommended tool
  ---------------- ------------------
  Server state     TanStack Query
  Local UI state   Zustand
  Forms            React Hook Form
  Validation       Zod
  Video playback   hls.js

The backend is authoritative for progress and unlocking. Do not rely on
Zustand or local storage as the source of truth for course completion.

------------------------------------------------------------------------

## 10. Certificate generation

When all modules are completed:

1.  Mark the enrollment as completed.
2.  Enqueue a BullMQ certificate job.
3.  Generate a PDF containing the student's name, course name,
    completion date, unique certificate number, and organization
    details.
4.  Store the PDF.
5.  Save the certificate record.
6.  Make it available for download.
7.  Provide a public verification endpoint.

Certificate generation must be idempotent so retries cannot issue
duplicate certificates for the same enrollment.

------------------------------------------------------------------------

## 11. Initial VPS deployment

### Proposed Hostinger KVM 4

  -----------------------------------------------------------------------
  Resource                                             Plan specification
  ------------------------------ ----------------------------------------
  vCPU                                                                  4

  RAM                                                               16 GB

  NVMe                                                             200 GB

  Monthly bandwidth                                                 16 TB

  Network                         Verify advertised port speed and actual
                                                     sustained throughput
  -----------------------------------------------------------------------

This is a reasonable initial configuration to test for the stated
workload. It is not a capacity guarantee. Verify current provider terms,
data-center location, bandwidth policy, and Bangladesh connectivity
before purchasing.

### Docker Compose services

``` text
services:
  frontend:   # Next.js
  backend:    # NestJS API
  nginx:      # Reverse proxy and HLS delivery
  postgres:   # PostgreSQL
  redis:      # Redis
  worker:     # BullMQ worker and FFmpeg
```

Use persistent volumes for PostgreSQL, Redis where appropriate, original
videos, HLS output, temporary processing, and certificates.

Suggested disk layout:

``` text
/srv/lms/
├── postgres/
├── redis/
├── videos/
│   ├── originals/
│   ├── hls/
│   └── temporary/
├── certificates/
└── backups/
```

### Nginx considerations

-   Serve HLS files directly; do not proxy segment bytes through NestJS.
-   Set correct MIME types for `.m3u8`, `.ts`, and `.m4s`.
-   Enable efficient static-file serving.
-   Use long-lived caching for immutable segments and appropriate
    caching for playlists.
-   Enable HTTP range support where required.
-   Disable directory listing.
-   Gzip playlists if useful; do not gzip already-compressed video
    segments.

Example baseline:

``` nginx
sendfile on;
tcp_nopush on;
tcp_nodelay on;

open_file_cache max=10000 inactive=60s;
open_file_cache_valid 120s;
open_file_cache_min_uses 2;
open_file_cache_errors on;
```

### Resource management

Treat resource allocations as initial budgets, then adjust from
measurements:

-   NestJS: approximately 1--2 GB RAM.
-   PostgreSQL: approximately 2--3 GB RAM.
-   Redis: approximately 512 MB--1 GB.
-   Nginx: approximately 512 MB.
-   Worker: controlled memory and CPU allocation.
-   Keep remaining resources for the OS, filesystem cache, and other
    services.

Do not let FFmpeg consume all available CPU while students are
streaming.

### Backups and availability

A single VPS is a single failure domain. Before production:

-   Configure automated daily PostgreSQL backups.
-   Store backups outside the VPS.
-   Back up original videos and important generated assets offsite.
-   Test restoring the database and a sample video.
-   Configure HTTPS, firewall rules, SSH hardening, and log rotation.
-   Document recovery procedures.

------------------------------------------------------------------------

## 12. Load testing and production acceptance

Test actual HLS playback, not just API requests. Run load generators
outside the VPS.

### Concurrency ramp

``` text
50 viewers
   |
100 viewers
   |
150 viewers
   |
200 viewers
   |
250 viewers (headroom test)
```

Distribute virtual users across different videos and resolutions.
Include playlist requests, segment downloads, seeking, playback
resumption, and progress updates.

Test both: - Warm-cache playback, where segments are already in the
Linux filesystem cache. - Cold-cache playback, where students request
different video files and segments.

### Monitor

``` bash
htop
iostat -xz 1
nload
docker stats
```

Also track: - CPU utilization and CPU steal. - RAM and swap. - Network
throughput and packet loss. - Disk I/O latency and utilization. - Nginx
4xx/5xx rates. - Playlist and segment response times. - PostgreSQL
connections and slow queries. - Redis memory and queue depth. - Player
startup time, buffering ratio, and playback errors.

### Suggested initial acceptance criteria

-   Sustain 200 concurrent playback sessions for 30--60 minutes.
-   No unexpected HTTP 5xx responses.
-   Less than 1% playback-related request failures.
-   No sustained CPU, disk, or network saturation.
-   Stable segment response times.
-   No lost or regressing progress updates.
-   Smooth playback for test clients with sufficient network capacity.

These are proposed test targets, not guarantees. Define exact latency
and rebuffering thresholds after establishing a baseline on your actual
network and player.

------------------------------------------------------------------------

## 13. Scaling strategy

Avoid coupling the application to a physical video path. Store a stable
`assetKey` in the database and resolve it through a storage/delivery
abstraction.

This makes future migration easier.

  -----------------------------------------------------------------------
  Bottleneck                          Scaling response
  ----------------------------------- -----------------------------------
  Monthly video bandwidth nearing     Add CDN or move to a
  quota                               higher-bandwidth origin

  Video origin network saturated      Add another origin or CDN

  FFmpeg delays uploads               Move transcoding to a dedicated
                                      worker

  API CPU pressure                    Move application to a separate VPS

  Database pressure                   Move PostgreSQL to a dedicated
                                      server and optimize queries

  Redis queue backlog                 Add worker capacity and review
                                      Redis sizing

  Availability requirements increase  Introduce redundant application and
                                      database infrastructure
  -----------------------------------------------------------------------

A sensible evolution is:

1.  Start with one KVM 4 VPS and separate containers.
2.  Measure real usage and complete the 200--250 viewer load test.
3.  Move video delivery to a dedicated VPS if it competes with
    API/database workloads.
4.  Add a CDN if geographic performance or bandwidth economics justify
    it.
5.  Scale the database and workers independently when measurements
    require it.

------------------------------------------------------------------------

## 14. Implementation roadmap

  -----------------------------------------------------------------------
  Phase                               Deliverables
  ----------------------------------- -----------------------------------
  1\. Foundation                      NestJS, Next.js, PostgreSQL,
                                      Prisma, authentication, roles

  2\. Course management               Course CRUD, modules, video
                                      metadata, enrollment

  3\. Video infrastructure            Upload, FFmpeg, HLS generation,
                                      Nginx delivery

  4\. Student learning                Player, quality selection, resume,
                                      progress tracking

  5\. Assessment                      Quiz management, attempts, scoring,
                                      module unlocking

  6\. Certification                   Course completion, PDF generation,
                                      verification

  7\. Production deployment           Docker Compose, HTTPS, backups,
                                      monitoring

  8\. Load testing                    200--250 concurrent playback
                                      sessions and tuning
  -----------------------------------------------------------------------

**Validate video delivery early.** It is the most
infrastructure-sensitive part of this project. Do not wait until the
entire LMS is complete to discover that the selected server or encoding
profile cannot deliver the required playback experience.

------------------------------------------------------------------------

## 15. Final recommendation

Start with the Hostinger KVM 4 configuration, provided its current
bandwidth policy and network performance meet your needs:

-   4 vCPU
-   16 GB RAM
-   200 GB NVMe
-   16 TB monthly bandwidth
-   Verify the advertised network port and sustained throughput

Use HLS with 360p, 480p, 720p, and 1080p renditions; make Auto quality
the default; serve segments directly through Nginx; use NestJS for
authorization and learning logic; and use PostgreSQL as the durable
source of truth.

A CDN is not mandatory for the initial rollout. Begin with VPS-only
delivery, measure real playback quality and bandwidth, and add
infrastructure when evidence shows it is needed.

### Technical references

-   Apple: [HTTP Live Streaming](https://developer.apple.com/streaming/)
-   Apple: [HLS Authoring
    Specification](https://developer.apple.com/documentation/http-live-streaming/hls-authoring-specification-for-apple-devices)
-   Hostinger: [VPS plans](https://www.hostinger.com/vps-hosting)
-   Hostinger: [VPS
    documentation](https://www.hostinger.com/tutorials/vps)
