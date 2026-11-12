import { describe, expect, test } from "vitest";
import { routeOutboxEvent } from "../../src/outbox/outbox-routing";

const userId = "0194f3a0-0000-7000-8000-000000000001";
const enrollmentId = "0194f3a0-0000-7000-8000-000000000002";

describe("routeOutboxEvent", () => {
  test("routes a templated event to the email queue with the template category", () => {
    expect(
      routeOutboxEvent("student.registration.already_registered", {
        template: "student-already-registered",
        userId,
      }),
    ).toEqual({
      outcome: "routed",
      actions: [
        { kind: "email", template: "student-already-registered", category: "VERIFICATION", userId },
      ],
    });
  });

  test("routes the registration event with a verification template to the email queue", () => {
    expect(
      routeOutboxEvent("EnrollmentRequested", {
        userId,
        enrollmentId,
        courseId: enrollmentId,
        template: "student-verification",
        encryptedToken: "sealed",
      }),
    ).toEqual({
      outcome: "routed",
      actions: [
        { kind: "email", template: "student-verification", category: "VERIFICATION", userId },
      ],
    });
  });

  test("routes the resend event to the verification email", () => {
    expect(
      routeOutboxEvent("student.verification.resend", {
        template: "student-verification",
        userId,
        encryptedToken: "sealed",
      }),
    ).toEqual({
      outcome: "routed",
      actions: [
        { kind: "email", template: "student-verification", category: "VERIFICATION", userId },
      ],
    });
  });

  test("routes an uploaded video to the probe queue", () => {
    const assetId = "0194f3a0-0000-7000-8000-000000000009";
    expect(routeOutboxEvent("video.uploaded", { assetId })).toEqual({
      outcome: "routed",
      actions: [{ kind: "probe", assetId }],
    });
  });

  test("routes a queued video to the transcode queue", () => {
    const assetId = "0194f3a0-0000-7000-8000-000000000009";
    expect(routeOutboxEvent("video.queued", { assetId })).toEqual({
      outcome: "routed",
      actions: [{ kind: "transcode", assetId }],
    });
    expect(routeOutboxEvent("video.queued", { assetId: "x" })).toEqual({
      outcome: "skipped",
      reason: "invalid video payload",
    });
  });

  test("skips an uploaded video event with an invalid payload", () => {
    expect(routeOutboxEvent("video.uploaded", { assetId: "../../etc" })).toEqual({
      outcome: "skipped",
      reason: "invalid video payload",
    });
  });

  test("routes a certificate request to the certificate queue", () => {
    expect(routeOutboxEvent("certificate.requested", { enrollmentId })).toEqual({
      outcome: "routed",
      actions: [{ kind: "certificate", enrollmentId }],
    });
  });

  test("routes one event to several consumers", () => {
    const routing = routeOutboxEvent("certificate.requested", {
      enrollmentId,
      template: "certificate-ready",
      userId,
      notification: { type: "CERTIFICATE_READY" },
    });
    expect(routing.outcome === "routed" && routing.actions.map((action) => action.kind)).toEqual([
      "certificate",
      "email",
      "notification",
    ]);
  });

  test("creates an in-app notification with default data", () => {
    expect(
      routeOutboxEvent("enrollment.approved", {
        userId,
        notification: { type: "ENROLLMENT_APPROVED" },
      }),
    ).toEqual({
      outcome: "routed",
      actions: [{ kind: "notification", userId, type: "ENROLLMENT_APPROVED", data: {} }],
    });
  });

  test("skips events nothing consumes yet", () => {
    expect(
      routeOutboxEvent("EnrollmentRequested", { userId, enrollmentId, courseId: enrollmentId }),
    ).toEqual({ outcome: "skipped", reason: "no consumer for event type" });
  });

  test("skips an unknown template and an invalid certificate payload", () => {
    expect(routeOutboxEvent("x", { template: "nope", userId })).toEqual({
      outcome: "skipped",
      reason: "unknown email template",
    });
    expect(routeOutboxEvent("certificate.requested", {})).toEqual({
      outcome: "skipped",
      reason: "invalid certificate payload",
    });
  });

  test("routes a news published event to a student notification and no email", () => {
    const postId = "0194f3a0-0000-7000-8000-0000000000aa";
    const routing = routeOutboxEvent("news.published", {
      postId,
      slug: "orientation",
      title: "Orientation",
    });
    expect(routing).toEqual({
      outcome: "routed",
      actions: [
        {
          kind: "news-notification",
          data: { postId, slug: "orientation", title: "Orientation" },
        },
      ],
    });
  });

  test("skips a news published event with an invalid payload", () => {
    expect(routeOutboxEvent("news.published", {})).toEqual({
      outcome: "skipped",
      reason: "invalid news payload",
    });
  });
});
