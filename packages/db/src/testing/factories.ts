import { randomUUID } from "node:crypto";
import type { HeatClient } from "../client";
import type { EnrollmentStatus, Realm, UserRole } from "../generated/client";

export interface UserOptions {
  email?: string;
  role?: UserRole;
  verified?: boolean;
}

export interface DepartmentOptions {
  name?: string;
  universityId?: string;
  facultyId?: string;
}

export interface CourseOptions {
  title?: string;
  slug?: string;
  published?: boolean;
}

export interface EnrollmentOptions {
  userId: string;
  courseId: string;
  status?: EnrollmentStatus;
  adminId?: string;
}

const unique = (): string => randomUUID().replaceAll("-", "").slice(0, 12);

const realmFor = (role: UserRole): Realm => (role === "STUDENT" ? "STUDENT" : "ADMIN");

const pinsRevision = (status: EnrollmentStatus): boolean =>
  status === "APPROVED" || status === "COMPLETED";

export const createFactories = (prisma: HeatClient) => {
  const user = async (options: UserOptions = {}) => {
    const role = options.role ?? "STUDENT";
    return prisma.user.create({
      data: {
        email: options.email ?? `user-${unique()}@example.test`,
        passwordHash: "argon2id-hash",
        role,
        realm: realmFor(role),
        emailVerifiedAt: options.verified === false ? null : new Date(),
      },
    });
  };

  const admin = (options: Omit<UserOptions, "role"> = {}) => user({ ...options, role: "ADMIN" });

  const university = (name?: string) =>
    prisma.university.create({ data: { name: name ?? `University ${unique()}` } });

  const faculty = (name?: string) =>
    prisma.faculty.create({ data: { name: name ?? `Faculty ${unique()}` } });

  const department = async (options: DepartmentOptions = {}) => {
    const universityId = options.universityId ?? (await university()).id;
    const facultyId = options.facultyId ?? (await faculty()).id;
    await prisma.universityFaculty.upsert({
      where: { universityId_facultyId: { universityId, facultyId } },
      create: { universityId, facultyId },
      update: {},
    });
    return prisma.department.create({
      data: { name: options.name ?? `Department ${unique()}`, universityId, facultyId },
    });
  };

  const student = async (options: UserOptions & { departmentId?: string } = {}) => {
    const departmentId = options.departmentId ?? (await department()).id;
    const created = await user({ ...options, role: "STUDENT" });
    const profile = await prisma.studentProfile.create({
      data: { userId: created.id, name: `Student ${unique()}`, departmentId, session: "2024-25" },
    });
    return { user: created, profile };
  };

  const course = async (options: CourseOptions = {}) => {
    const published = options.published ?? true;
    const now = new Date();
    const created = await prisma.course.create({
      data: {
        slug: options.slug ?? `course-${unique()}`,
        title: options.title ?? `Course ${unique()}`,
        status: published ? "PUBLISHED" : "DRAFT",
        publishedAt: published ? now : null,
      },
    });
    const revision = await prisma.courseRevision.create({
      data: { courseId: created.id, number: 1, publishedAt: published ? now : null },
    });
    return { course: created, revision };
  };

  const enrollment = async (options: EnrollmentOptions) => {
    const status = options.status ?? "PENDING_APPROVAL";
    const revision = pinsRevision(status)
      ? await prisma.courseRevision.findFirstOrThrow({
          where: { courseId: options.courseId },
          orderBy: { number: "desc" },
        })
      : null;
    const created = await prisma.enrollment.create({
      data: {
        userId: options.userId,
        courseId: options.courseId,
        status,
        courseRevisionId: revision?.id ?? null,
        approvedAt: status === "APPROVED" ? new Date() : null,
      },
    });
    if (status === "APPROVED") {
      const adminId = options.adminId ?? (await admin()).id;
      await prisma.enrollmentDecision.create({
        data: { enrollmentId: created.id, adminId, action: "APPROVE" },
      });
    }
    return created;
  };

  const approvedStudentInPublishedCourse = async () => {
    const enrolled = await student();
    const published = await course({ published: true });
    const approver = await admin();
    const approved = await enrollment({
      userId: enrolled.user.id,
      courseId: published.course.id,
      status: "APPROVED",
      adminId: approver.id,
    });
    return {
      user: enrolled.user,
      profile: enrolled.profile,
      admin: approver,
      course: published.course,
      revision: published.revision,
      enrollment: approved,
    };
  };

  return {
    user,
    admin,
    university,
    faculty,
    department,
    student,
    course,
    enrollment,
    approvedStudentInPublishedCourse,
  };
};

export type Factories = ReturnType<typeof createFactories>;
