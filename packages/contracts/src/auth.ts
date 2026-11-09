import { z } from "zod";

export const userRoles = ["SUPER_ADMIN", "ADMIN", "STUDENT"] as const;
export const userRoleSchema = z.enum(userRoles);
export type UserRoleName = z.infer<typeof userRoleSchema>;

export const enrollmentStatuses = [
  "PENDING_VERIFICATION",
  "PENDING_APPROVAL",
  "APPROVED",
  "COMPLETED",
  "REJECTED",
  "EXPIRED",
  "REMOVED",
] as const;
export const enrollmentStatusSchema = z.enum(enrollmentStatuses);
export type EnrollmentStatusName = z.infer<typeof enrollmentStatusSchema>;

export const courseAccessStatuses = ["APPROVED", "COMPLETED"] as const satisfies ReadonlyArray<
  (typeof enrollmentStatuses)[number]
>;

export const grantsCourseAccess = (status: EnrollmentStatusName): boolean =>
  (courseAccessStatuses as ReadonlyArray<string>).includes(status);

export const signInRequestSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .pipe(z.email("Enter a valid email address.").max(254, "Enter a valid email address.")),
  password: z.string().min(1, "Enter your password.").max(256, "Enter your password."),
});

export type SignInRequest = z.infer<typeof signInRequestSchema>;

export const meEnrollmentSchema = z.object({
  courseId: z.uuid(),
  courseSlug: z.string(),
  courseTitle: z.string(),
  status: enrollmentStatusSchema,
  reason: z.string().optional(),
});

export type MeEnrollment = z.infer<typeof meEnrollmentSchema>;

export const meResponseSchema = z.object({
  user: z.object({
    id: z.uuid(),
    email: z.string(),
    name: z.string().optional(),
    role: userRoleSchema,
    emailVerified: z.boolean(),
    mustChangePassword: z.boolean(),
  }),
  enrollments: z.array(meEnrollmentSchema),
});

export type MeResponse = z.infer<typeof meResponseSchema>;

export const landingPathFor = (
  enrollments: ReadonlyArray<{ status: EnrollmentStatusName }>,
): string =>
  enrollments.some((enrollment) => grantsCourseAccess(enrollment.status))
    ? "/dashboard"
    : "/awaiting-approval";
