import { describe, expect, test } from "vitest";
import { PasswordService, SessionService, realmCookies } from "../../src/auth";
import { csrfHeaders } from "../support/csrf";
import { useTestApp } from "../support/testing-module";

const password = "correct horse battery staple";

interface Reply {
  status: number;
  body: unknown;
}

interface Department {
  id: string;
  name: string;
  studentCount: number;
  university: { id: string; name: string };
  faculty: { id: string; name: string };
}

interface Page {
  items: Department[];
  total: number;
}

const cookieHeader = (setCookies: string[]): string =>
  setCookies
    .map((line) => line.split(";")[0] ?? "")
    .filter((pair) => !pair.endsWith("="))
    .join("; ");

const errorOf = (reply: Reply): { code: string; message: string } =>
  (reply.body as { error: { code: string; message: string } }).error;

describe("department directory over HTTP", () => {
  const testApp = useTestApp();

  const call = async (
    method: "GET" | "POST" | "PATCH" | "PUT" | "DELETE",
    path: string,
    options: { cookie?: string; body?: unknown } = {},
  ): Promise<Reply> => {
    const response = await fetch(`${testApp().baseUrl}/api${path}`, {
      method,
      headers: {
        ...(options.cookie ? { cookie: options.cookie } : {}),
        ...csrfHeaders(options.cookie),
        ...(options.body === undefined ? {} : { "content-type": "application/json" }),
      },
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    });
    const text = await response.text();
    return { status: response.status, body: text === "" ? undefined : JSON.parse(text) };
  };

  const signedInAdmin = async () => {
    const user = await testApp().factories.user({ role: "ADMIN" });
    await testApp().database.prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: await testApp().moduleRef.get(PasswordService).hash(password) },
    });
    const response = await fetch(`${testApp().baseUrl}/api/admin/auth/sign-in`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: user.email, password }),
    });
    return { user, cookie: cookieHeader(response.headers.getSetCookie()) };
  };

  const base = "/admin/directory/departments";
  const unknown = "0198f1a0-0000-7000-8000-00000000dead";

  const link = (universityId: string, facultyId: string) =>
    testApp().database.prisma.universityFaculty.upsert({
      where: { universityId_facultyId: { universityId, facultyId } },
      create: { universityId, facultyId },
      update: {},
    });

  const departmentRows = () => testApp().database.prisma.department.findMany();

  test("creating under a linked pair stores the department against that link and audits it", async () => {
    const admin = await signedInAdmin();
    const university = await testApp().factories.university("University of Dhaka");
    const faculty = await testApp().factories.faculty("Faculty of Arts");
    await link(university.id, faculty.id);

    const reply = await call("POST", base, {
      cookie: admin.cookie,
      body: { name: "  Bengali  ", universityId: university.id, facultyId: faculty.id },
    });

    const created = reply.body as Department;
    expect(reply.status).toBe(201);
    expect(created).toMatchObject({
      name: "Bengali",
      university: { id: university.id, name: "University of Dhaka" },
      faculty: { id: faculty.id, name: "Faculty of Arts" },
      studentCount: 0,
    });
    const audit = await testApp().database.prisma.auditLog.findFirstOrThrow({
      where: { entityId: created.id, action: "department.create" },
    });
    expect(audit).toMatchObject({
      actorId: admin.user.id,
      entity: "Department",
      after: {
        name: "Bengali",
        universityId: university.id,
        universityName: "University of Dhaka",
        facultyId: faculty.id,
        facultyName: "Faculty of Arts",
      },
    });
  });

  test("a faculty the university does not offer is a validation error and nothing is written", async () => {
    const admin = await signedInAdmin();
    const university = await testApp().factories.university();
    const faculty = await testApp().factories.faculty();
    const before = await testApp().database.prisma.auditLog.count();

    const reply = await call("POST", base, {
      cookie: admin.cookie,
      body: { name: "Bengali", universityId: university.id, facultyId: faculty.id },
    });

    expect(reply.status).toBe(400);
    expect(errorOf(reply).code).toBe("VALIDATION_FAILED");
    expect(await departmentRows()).toHaveLength(0);
    expect(await testApp().database.prisma.auditLog.count()).toBe(before);
  });

  test("the database foreign key refuses a department for a pair that is not linked", async () => {
    const university = await testApp().factories.university();
    const faculty = await testApp().factories.faculty();

    await expect(
      testApp().database.prisma.department.create({
        data: { name: "Orphan", universityId: university.id, facultyId: faculty.id },
      }),
    ).rejects.toMatchObject({ code: "P2003" });
    expect(await departmentRows()).toHaveLength(0);
  });

  test("the database foreign key refuses removing the link or deleting the department's student rows' target", async () => {
    const department = await testApp().factories.department();

    await expect(
      testApp().database.prisma.$executeRawUnsafe(
        `DELETE FROM "UniversityFaculty" WHERE "universityId" = '${department.universityId}'::uuid AND "facultyId" = '${department.facultyId}'::uuid`,
      ),
    ).rejects.toThrow();
    await testApp().factories.student({ departmentId: department.id });
    await expect(
      testApp().database.prisma.$executeRawUnsafe(
        `DELETE FROM "Department" WHERE id = '${department.id}'::uuid`,
      ),
    ).rejects.toThrow();
  });

  test("a name is unique per pair without case, and the same name under another pair is allowed", async () => {
    const admin = await signedInAdmin();
    const first = await testApp().factories.department({ name: "Bengali" });
    const otherFaculty = await testApp().factories.faculty();
    await link(first.universityId, otherFaculty.id);
    const before = await testApp().database.prisma.auditLog.count();

    const taken = await call("POST", base, {
      cookie: admin.cookie,
      body: { name: "bENGALI", universityId: first.universityId, facultyId: first.facultyId },
    });
    const otherPair = await call("POST", base, {
      cookie: admin.cookie,
      body: { name: "Bengali", universityId: first.universityId, facultyId: otherFaculty.id },
    });
    const sibling = await testApp().factories.department({
      name: "History",
      universityId: first.universityId,
      facultyId: first.facultyId,
    });
    const rename = await call("PATCH", `${base}/${sibling.id}`, {
      cookie: admin.cookie,
      body: { name: "BENGALI", universityId: first.universityId, facultyId: first.facultyId },
    });

    expect(taken.status).toBe(409);
    expect(errorOf(taken).code).toBe("DIRECTORY_NAME_TAKEN");
    expect(otherPair.status).toBe(201);
    expect(rename.status).toBe(409);
    expect(errorOf(rename).code).toBe("DIRECTORY_NAME_TAKEN");
    expect(await departmentRows()).toHaveLength(3);
    expect(await testApp().database.prisma.auditLog.count()).toBe(before + 1);
  });

  test("renaming records the old and new values in the audit entry", async () => {
    const admin = await signedInAdmin();
    const department = await testApp().factories.department({ name: "Old Name" });

    const reply = await call("PATCH", `${base}/${department.id}`, {
      cookie: admin.cookie,
      body: {
        name: "New Name",
        universityId: department.universityId,
        facultyId: department.facultyId,
      },
    });

    expect(reply.status).toBe(200);
    const audit = await testApp().database.prisma.auditLog.findFirstOrThrow({
      where: { entityId: department.id, action: "department.update" },
    });
    expect(audit).toMatchObject({
      actorId: admin.user.id,
      before: { name: "Old Name" },
      after: { name: "New Name" },
    });
  });

  test("an unreferenced department can move to another linked pair, and not to an unlinked one", async () => {
    const admin = await signedInAdmin();
    const department = await testApp().factories.department({ name: "Bengali" });
    const buet = await testApp().factories.university("BUET");
    const science = await testApp().factories.faculty("Faculty of Science");
    await link(buet.id, science.id);

    const unlinked = await call("PATCH", `${base}/${department.id}`, {
      cookie: admin.cookie,
      body: { name: "Bengali", universityId: buet.id, facultyId: department.facultyId },
    });
    const moved = await call("PATCH", `${base}/${department.id}`, {
      cookie: admin.cookie,
      body: { name: "Bengali", universityId: buet.id, facultyId: science.id },
    });

    expect(unlinked.status).toBe(400);
    expect(moved.status).toBe(200);
    expect(moved.body).toMatchObject({ university: { id: buet.id }, faculty: { id: science.id } });
  });

  test("moving a department that students reference, a soft-deleted profile included, is DIRECTORY_IN_USE", async () => {
    const admin = await signedInAdmin();
    const department = await testApp().factories.department({ name: "Bengali" });
    const { profile } = await testApp().factories.student({ departmentId: department.id });
    await testApp().database.prisma.studentProfile.update({
      where: { id: profile.id },
      data: { deletedAt: new Date() },
    });
    const buet = await testApp().factories.university("BUET");
    await link(buet.id, department.facultyId);

    const reply = await call("PATCH", `${base}/${department.id}`, {
      cookie: admin.cookie,
      body: { name: "Bengali", universityId: buet.id, facultyId: department.facultyId },
    });

    expect(reply.status).toBe(409);
    expect(errorOf(reply).code).toBe("DIRECTORY_IN_USE");
    expect(errorOf(reply).message).toContain("1 student");
    expect(
      await testApp().database.prisma.department.findUniqueOrThrow({
        where: { id: department.id },
      }),
    ).toMatchObject({ universityId: department.universityId });
  });

  test("renaming a department that students reference is allowed", async () => {
    const admin = await signedInAdmin();
    const department = await testApp().factories.department({ name: "Bengali" });
    await testApp().factories.student({ departmentId: department.id });

    const reply = await call("PATCH", `${base}/${department.id}`, {
      cookie: admin.cookie,
      body: {
        name: "Bangla",
        universityId: department.universityId,
        facultyId: department.facultyId,
      },
    });

    expect(reply.status).toBe(200);
    expect(reply.body).toMatchObject({ name: "Bangla", studentCount: 1 });
  });

  test("delete is refused with DIRECTORY_IN_USE counting a soft-deleted student, and nothing changes", async () => {
    const admin = await signedInAdmin();
    const department = await testApp().factories.department();
    await testApp().factories.student({ departmentId: department.id });
    const { profile } = await testApp().factories.student({ departmentId: department.id });
    await testApp().database.prisma.studentProfile.update({
      where: { id: profile.id },
      data: { deletedAt: new Date() },
    });
    const before = await testApp().database.prisma.auditLog.count();

    const reply = await call("DELETE", `${base}/${department.id}`, { cookie: admin.cookie });

    expect(reply.status).toBe(409);
    expect(errorOf(reply).code).toBe("DIRECTORY_IN_USE");
    expect(errorOf(reply).message).toContain("2 students");
    expect(await departmentRows()).toHaveLength(1);
    expect(await testApp().database.prisma.auditLog.count()).toBe(before);
  });

  test("an unreferenced department is deleted, disappears from the list and the delete is audited", async () => {
    const admin = await signedInAdmin();
    const department = await testApp().factories.department({ name: "Unused" });

    const reply = await call("DELETE", `${base}/${department.id}`, { cookie: admin.cookie });

    expect(reply.status).toBe(204);
    const list = await call("GET", base, { cookie: admin.cookie });
    expect((list.body as Page).items).toEqual([]);
    expect((await call("GET", `${base}/${department.id}`, { cookie: admin.cookie })).status).toBe(
      404,
    );
    const audit = await testApp().database.prisma.auditLog.findFirstOrThrow({
      where: { entityId: department.id, action: "department.delete" },
    });
    expect(audit).toMatchObject({ actorId: admin.user.id, before: { name: "Unused" } });
  });

  test("update and delete of an unknown id are NOT_FOUND", async () => {
    const admin = await signedInAdmin();
    const university = await testApp().factories.university();
    const faculty = await testApp().factories.faculty();

    const update = await call("PATCH", `${base}/${unknown}`, {
      cookie: admin.cookie,
      body: { name: "X", universityId: university.id, facultyId: faculty.id },
    });
    const remove = await call("DELETE", `${base}/${unknown}`, { cookie: admin.cookie });

    expect(update.status).toBe(404);
    expect(remove.status).toBe(404);
  });

  test("the list filters by university and faculty and reports student counts with soft-deleted profiles", async () => {
    const admin = await signedInAdmin();
    const arts = await testApp().factories.department({ name: "Bengali" });
    const science = await testApp().factories.department({ name: "Physics" });
    const { profile } = await testApp().factories.student({ departmentId: arts.id });
    await testApp().factories.student({ departmentId: arts.id });
    await testApp().database.prisma.studentProfile.update({
      where: { id: profile.id },
      data: { deletedAt: new Date() },
    });

    const all = await call("GET", base, { cookie: admin.cookie });
    const byUniversity = await call("GET", `${base}?universityId=${arts.universityId}`, {
      cookie: admin.cookie,
    });
    const byFaculty = await call("GET", `${base}?facultyId=${science.facultyId}`, {
      cookie: admin.cookie,
    });
    const byBoth = await call(
      "GET",
      `${base}?universityId=${arts.universityId}&facultyId=${science.facultyId}`,
      { cookie: admin.cookie },
    );

    expect((all.body as Page).total).toBe(2);
    expect((byUniversity.body as Page).items.map((item) => item.id)).toEqual([arts.id]);
    expect((byUniversity.body as Page).items[0]).toMatchObject({ studentCount: 2 });
    expect((byFaculty.body as Page).items.map((item) => item.id)).toEqual([science.id]);
    expect((byBoth.body as Page).items).toEqual([]);
  });

  test("the list is paged and sorted by name", async () => {
    const admin = await signedInAdmin();
    const first = await testApp().factories.department({ name: "Charlie" });
    for (const name of ["Alpha", "Bravo"]) {
      await testApp().factories.department({
        name,
        universityId: first.universityId,
        facultyId: first.facultyId,
      });
    }

    const reply = await call("GET", `${base}?pageSize=10&sort=-name`, { cookie: admin.cookie });

    expect((reply.body as Page).items.map((item) => item.name)).toEqual([
      "Charlie",
      "Bravo",
      "Alpha",
    ]);
  });

  test("a student session gets 403 on every department endpoint and an anonymous caller gets 401", async () => {
    const { user } = await testApp().factories.student();
    const tokens = await testApp().moduleRef.get(SessionService).create(user.id, "student");
    const cookie = `${realmCookies.student.access}=${tokens.accessToken}`;
    const department = await testApp().factories.department();
    const id = department.id;
    const body = {
      name: "X",
      universityId: department.universityId,
      facultyId: department.facultyId,
    };

    const replies = await Promise.all([
      call("GET", base, { cookie }),
      call("GET", `${base}/${id}`, { cookie }),
      call("POST", base, { cookie, body }),
      call("PATCH", `${base}/${id}`, { cookie, body }),
      call("DELETE", `${base}/${id}`, { cookie }),
    ]);

    expect(replies.map((reply) => reply.status)).toEqual([403, 403, 403, 403, 403]);
    expect((await call("GET", base)).status).toBe(401);
    expect((await call("DELETE", `${base}/${id}`)).status).toBe(401);
  });
});
