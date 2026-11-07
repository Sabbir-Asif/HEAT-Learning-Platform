# 0016. Images and files on local disk behind a storage interface

- Status: Accepted
- Date: 2026-11-07
- Plan: [D16, section 02 Design decisions](../plan/heat-lms-project-plan.html#decisions)

## Context

The platform stores images, documents, captions, avatars and certificates on a single VPS. Files differ in who may see them, and the storage location may change later.

## Decision

- Every upload goes through one `media` module and one storage interface. A local-disk driver is the only driver for now.
- Uploads are type-checked from their bytes, stripped of metadata and resized once, then stored under random names. SVG and other script-capable formats are rejected.
- Each file has a visibility level: public, protected (signed 1-hour links) or private (API-checked).
- Content stores asset IDs, not links, so a cloud S3 driver or a CDN can be added later without touching content.
- MinIO was rejected.
- Nginx serves the files and Node never streams them.

## Consequences

- The media volume is part of the nightly encrypted off-site backup.
- Unlinked uploads are removed by a daily cleanup job after 24 hours.
- Adding Cloudflare R2, Backblaze B2 or AWS S3 means adding a driver, with no change to other code.

## Alternatives considered

- MinIO as an object store. Named in the frontend design spec and rejected by the owner: its free edition stopped shipping images in October 2025, its repository was archived in 2026, and on a single VPS it adds a network hop for every file without adding durability.
- Storing URLs in content. Named in the plan: content stores asset IDs instead, so the URL scheme can change.
