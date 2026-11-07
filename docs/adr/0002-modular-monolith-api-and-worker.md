# 0002. Modular monolith API, separate worker process

- Status: Accepted
- Date: 2026-11-07
- Plan: [D2, section 02 Design decisions](../plan/heat-lms-project-plan.html#decisions)

## Context

The system runs on one VPS and is built by a small team. It also does heavy work (video transcoding, certificate rendering) that must not slow down HTTP traffic.

## Decision

- The API is a NestJS modular monolith with strict module boundaries.
- The worker is the same codebase started with a different entry point. It runs the BullMQ consumers (transcode, certificate, email, cleanup) and opens no HTTP port.
- FFmpeg never shares a process with HTTP traffic.
- No microservices, Kubernetes or Kafka.

## Consequences

- One codebase, one deployment unit per process type, and shared modules between API and worker.
- Module boundaries are enforced by convention and review, because nothing separates them at runtime.
- The worker can be limited in CPU and priority without touching the API.

## Alternatives considered

- Microservices, Kubernetes and Kafka. Named in the plan and rejected: too much operating cost for one VPS and a small team.
- Running FFmpeg and Chromium inside the API process. Derived from the plan's rationale: heavy jobs would compete with HTTP requests, which the separate process prevents.
