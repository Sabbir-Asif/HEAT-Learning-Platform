import { z } from "zod";
import { listEmailTemplates, type EmailCategory } from "../email";

export const notificationTypes = [
  "ENROLLMENT_APPROVED",
  "ENROLLMENT_REJECTED",
  "ENROLLMENT_REMOVED",
  "ENROLLMENT_REINSTATED",
  "CERTIFICATE_READY",
  "NEWS_PUBLISHED",
] as const;

export type NotificationKind = (typeof notificationTypes)[number];

export const CERTIFICATE_REQUESTED_EVENT_TYPE = "certificate.requested";

export type RoutedAction =
  | { kind: "email"; template: string; category: EmailCategory; userId: string }
  | { kind: "certificate"; enrollmentId: string }
  | { kind: "notification"; userId: string; type: NotificationKind; data: Record<string, unknown> };

export type Routing =
  { outcome: "routed"; actions: RoutedAction[] } | { outcome: "skipped"; reason: string };

const emailEnvelope = z.object({ template: z.string().min(1), userId: z.uuid() });
const certificateEnvelope = z.object({ enrollmentId: z.uuid() });
const notificationEnvelope = z.object({
  userId: z.uuid(),
  notification: z.object({
    type: z.enum(notificationTypes),
    data: z.record(z.string(), z.unknown()).default({}),
  }),
});

const categoryByTemplate = new Map(
  listEmailTemplates().map(({ key, category }) => [key, category] as const),
);

export const routeOutboxEvent = (eventType: string, payload: unknown): Routing => {
  const actions: RoutedAction[] = [];

  if (eventType === CERTIFICATE_REQUESTED_EVENT_TYPE) {
    const certificate = certificateEnvelope.safeParse(payload);
    if (!certificate.success) return { outcome: "skipped", reason: "invalid certificate payload" };
    actions.push({ kind: "certificate", enrollmentId: certificate.data.enrollmentId });
  }

  const email = emailEnvelope.safeParse(payload);
  if (email.success) {
    const category = categoryByTemplate.get(email.data.template);
    if (category === undefined) return { outcome: "skipped", reason: "unknown email template" };
    actions.push({
      kind: "email",
      template: email.data.template,
      category,
      userId: email.data.userId,
    });
  }

  const notification = notificationEnvelope.safeParse(payload);
  if (notification.success) {
    actions.push({
      kind: "notification",
      userId: notification.data.userId,
      type: notification.data.notification.type,
      data: notification.data.notification.data,
    });
  }

  if (actions.length === 0) return { outcome: "skipped", reason: "no consumer for event type" };
  return { outcome: "routed", actions };
};
