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

export const emailAddressSchema = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email("Enter a valid email address.").max(254, "Enter a valid email address."));

export const signInRequestSchema = z.object({
  email: emailAddressSchema,
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

export const studentSessionCookies = {
  access: "__Host-heat_access",
  refresh: "__Secure-heat_refresh",
  refreshPath: "/api/auth/refresh",
} as const;

export const adminSessionCookies = {
  access: "__Host-heat_admin_access",
  refresh: "__Secure-heat_admin_refresh",
  refreshPath: "/api/admin/auth/refresh",
} as const;

export const csrfHeaderName = "x-csrf-token";

export const studentCsrf = {
  cookie: "__Host-heat_csrf",
  tokenPath: "/api/auth/csrf",
} as const;

export const adminCsrf = {
  cookie: "__Host-heat_admin_csrf",
  tokenPath: "/api/admin/auth/csrf",
} as const;

export const csrfTokenResponseSchema = z.object({
  token: z.string(),
});

export type CsrfTokenResponse = z.infer<typeof csrfTokenResponseSchema>;

export const passwordMinLength = 12;
export const passwordMaxLength = 256;

export const adminMeResponseSchema = z.object({
  user: z.object({
    id: z.uuid(),
    email: z.string(),
    role: userRoleSchema,
    mustChangePassword: z.boolean(),
  }),
});

export type AdminMeResponse = z.infer<typeof adminMeResponseSchema>;

export const changePasswordRequestSchema = z
  .object({
    currentPassword: z.string().min(1, "Enter your current password.").max(passwordMaxLength),
    newPassword: z
      .string()
      .min(passwordMinLength, `Use at least ${passwordMinLength} characters.`)
      .max(passwordMaxLength, `Use at most ${passwordMaxLength} characters.`),
  })
  .refine((value) => value.currentPassword !== value.newPassword, {
    path: ["newPassword"],
    message: "Choose a password you have not used here before.",
  });

export type ChangePasswordRequest = z.infer<typeof changePasswordRequestSchema>;
