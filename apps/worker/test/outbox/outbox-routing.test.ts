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
});
