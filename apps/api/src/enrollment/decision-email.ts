import type { HeatClient } from "@heat/db";

export const ENROLLMENT_APPROVED_TEMPLATE = "enrollment-approved";
export const ENROLLMENT_REJECTED_TEMPLATE = "enrollment-rejected";
export const ENROLLMENT_REMOVED_TEMPLATE = "enrollment-removed";
export const ENROLLMENT_REINSTATED_TEMPLATE = "enrollment-reinstated";

export type DecisionEmailReader = Pick<HeatClient, "user" | "course">;

export interface DecisionEmailSnapshot {
  recipientAddress: string | undefined;
  courseTitle: string | undefined;
}

export const readDecisionEmailSnapshot = async (
  tx: DecisionEmailReader,
  userId: string,
  courseId: string,
): Promise<DecisionEmailSnapshot> => {
  const user = await tx.user.findFirst({ where: { id: userId }, select: { email: true } });
  const course = await tx.course.findFirst({ where: { id: courseId }, select: { title: true } });
  return { recipientAddress: user?.email, courseTitle: course?.title };
};

export const decisionEmailPayload = (
  template: string,
  snapshot: DecisionEmailSnapshot,
): Record<string, string> => ({
  template,
  ...(snapshot.recipientAddress === undefined
    ? {}
    : { recipientAddress: snapshot.recipientAddress }),
  ...(snapshot.courseTitle === undefined ? {} : { courseTitle: snapshot.courseTitle }),
});
