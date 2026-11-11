import { expect, test } from "vitest";
import { issuedEventPayload } from "../../src/certificate/prisma-certificate-store";
import { routeOutboxEvent } from "../../src/outbox/outbox-routing";

test("the issued event routes to the completion email and the ready notification", () => {
  const payload = issuedEventPayload({
    certificateId: "certificate-id",
    enrollmentId: "0194f3a0-0000-7000-8000-000000000001",
    userId: "0194f3a0-0000-7000-8000-000000000002",
    courseTitle: "Gender Safety Basics",
    number: "ABCD-EFGH-JKMN",
  });

  const routing = routeOutboxEvent("certificate.issued", payload);

  expect(routing).toEqual({
    outcome: "routed",
    actions: [
      {
        kind: "email",
        template: "certificate-ready",
        category: "CERTIFICATE",
        userId: "0194f3a0-0000-7000-8000-000000000002",
      },
      {
        kind: "notification",
        userId: "0194f3a0-0000-7000-8000-000000000002",
        type: "CERTIFICATE_READY",
        data: {
          certificateId: "certificate-id",
          enrollmentId: "0194f3a0-0000-7000-8000-000000000001",
        },
      },
    ],
  });
});
