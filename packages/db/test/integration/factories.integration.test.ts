import { expect, test } from "vitest";
import { createFactories } from "../../src/testing";
import { useTestDatabase } from "./helpers";

const database = useTestDatabase();

test("one call creates an approved student in a published course", async () => {
  const factories = createFactories(database().prisma);

  const result = await factories.approvedStudentInPublishedCourse();

  expect(result.user.role).toBe("STUDENT");
  expect(result.profile.userId).toBe(result.user.id);
  expect(result.course.status).toBe("PUBLISHED");
  expect(result.enrollment.status).toBe("APPROVED");
  expect(result.enrollment.courseRevisionId).toBe(result.revision.id);
  expect(await database().prisma.enrollmentDecision.count()).toBe(1);
});

test("factories give every record unique values", async () => {
  const factories = createFactories(database().prisma);

  const first = await factories.student();
  const second = await factories.student();
  const draft = await factories.course({ published: false });

  expect(first.user.email).not.toBe(second.user.email);
  expect(draft.course.status).toBe("DRAFT");
  expect(draft.revision.publishedAt).toBeNull();
});

test("a department reuses an existing university and faculty link", async () => {
  const factories = createFactories(database().prisma);
  const university = await factories.university();
  const faculty = await factories.faculty();

  const first = await factories.department({ universityId: university.id, facultyId: faculty.id });
  const second = await factories.department({
    universityId: university.id,
    facultyId: faculty.id,
  });

  expect(first.id).not.toBe(second.id);
  expect(await database().prisma.universityFaculty.count()).toBe(1);
});

test("a pending enrollment has no pinned revision and an admin user has the admin realm", async () => {
  const factories = createFactories(database().prisma);
  const { user } = await factories.student();
  const { course } = await factories.course();
  const admin = await factories.admin();

  const enrollment = await factories.enrollment({ userId: user.id, courseId: course.id });

  expect(enrollment.status).toBe("PENDING_APPROVAL");
  expect(enrollment.courseRevisionId).toBeNull();
  expect(admin.realm).toBe("ADMIN");
});
