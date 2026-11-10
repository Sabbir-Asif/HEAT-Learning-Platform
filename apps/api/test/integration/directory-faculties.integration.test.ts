import { describe, expect, test } from "vitest";
import { PasswordService, SessionService, realmCookies } from "../../src/auth";
import { csrfHeaders } from "../support/csrf";
import { useTestApp } from "../support/testing-module";

const password = "correct horse battery staple";

interface Reply {
  status: number;
  body: unknown;
}

interface Faculty {
  id: string;
  name: string;
  studentCount: number;
  departmentCount: number;
  universities: Array<{ id: string; name: string }>;
}

interface Page {
  items: Faculty[];
  total: number;
}

const cookieHeader = (setCookies: string[]): string =>
  setCookies
    .map((line) => line.split(";")[0] ?? "")
    .filter((pair) => !pair.endsWith("="))
    .join("; ");

const errorOf = (reply: Reply): { code: string; message: string } =>
  (reply.body as { error: { code: string; message: string } }).error;

describe("faculty directory over HTTP", () => {
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

  const base = "/admin/directory/faculties";
  const links = (facultyId: string) =>
    testApp().database.prisma.universityFaculty.findMany({ where: { facultyId } });

  test("create, assign to two universities, and both universities offer the faculty", async () => {
    const admin = await signedInAdmin();
    const dhaka = await testApp().factories.university("University of Dhaka");
    const buet = await testApp().factories.university("BUET");
    const other = await testApp().factories.university("Other University");

    const created = await call("POST", base, {
      cookie: admin.cookie,
      body: { name: "  Faculty   of Engineering " },
    });
    const faculty = created.body as Faculty;
    const first = await call("PUT", `${base}/${faculty.id}/universities/${dhaka.id}`, {
      cookie: admin.cookie,
    });
    const second = await call("PUT", `${base}/${faculty.id}/universities/${buet.id}`, {
      cookie: admin.cookie,
    });

    expect(created.status).toBe(201);
    expect(faculty).toMatchObject({ name: "Faculty of Engineering", universities: [] });
    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect((second.body as Faculty).universities.map((item) => item.name)).toEqual([
      "BUET",
      "University of Dhaka",
    ]);
    expect(await links(faculty.id)).toHaveLength(2);
    for (const university of [dhaka, buet]) {
      const offered = await call("GET", `${base}?universityId=${university.id}`, {
        cookie: admin.cookie,
      });
      expect((offered.body as Page).items.map((item) => item.id)).toEqual([faculty.id]);
    }
    const none = await call("GET", `${base}?universityId=${other.id}`, { cookie: admin.cookie });
    expect((none.body as Page).items).toEqual([]);
  });

  test("create, assign and unassign each write an audit entry with the actor and the values", async () => {
    const admin = await signedInAdmin();
    const university = await testApp().factories.university("University of Dhaka");
    const created = await call("POST", base, { cookie: admin.cookie, body: { name: "Arts" } });
    const faculty = created.body as Faculty;

    await call("PUT", `${base}/${faculty.id}/universities/${university.id}`, {
      cookie: admin.cookie,
    });
    await call("DELETE", `${base}/${faculty.id}/universities/${university.id}`, {
      cookie: admin.cookie,
    });

    const audit = (action: string) =>
      testApp().database.prisma.auditLog.findFirstOrThrow({
        where: { entityId: faculty.id, action },
      });
    const pair = { universityId: university.id, universityName: "University of Dhaka" };
    expect(await audit("faculty.create")).toMatchObject({
      actorId: admin.user.id,
      entity: "Faculty",
      after: { name: "Arts" },
    });
    expect(await audit("faculty.assign")).toMatchObject({ actorId: admin.user.id, after: pair });
    expect(await audit("faculty.unassign")).toMatchObject({
      actorId: admin.user.id,
      before: pair,
    });
  });

  test("assigning a faculty that is already assigned is idempotent and leaves one link", async () => {
    const admin = await signedInAdmin();
    const university = await testApp().factories.university();
    const faculty = await testApp().factories.faculty();
    const path = `${base}/${faculty.id}/universities/${university.id}`;

    const first = await call("PUT", path, { cookie: admin.cookie });
    const again = await call("PUT", path, { cookie: admin.cookie });

    expect(first.status).toBe(200);
    expect(again.status).toBe(200);
    expect(await links(faculty.id)).toHaveLength(1);
    expect((again.body as Faculty).universities).toHaveLength(1);
  });

  test("the unique (university, faculty) link is enforced by the database", async () => {
    const university = await testApp().factories.university();
    const faculty = await testApp().factories.faculty();
    const data = { universityId: university.id, facultyId: faculty.id };
    await testApp().database.prisma.universityFaculty.create({ data });

    await expect(testApp().database.prisma.universityFaculty.create({ data })).rejects.toThrow();
  });

  test("assign returns NOT_FOUND for an unknown faculty or university", async () => {
    const admin = await signedInAdmin();
    const university = await testApp().factories.university();
    const faculty = await testApp().factories.faculty();
    const unknown = "0198f1a0-0000-7000-8000-00000000dead";

    const noFaculty = await call("PUT", `${base}/${unknown}/universities/${university.id}`, {
      cookie: admin.cookie,
    });
    const noUniversity = await call("PUT", `${base}/${faculty.id}/universities/${unknown}`, {
      cookie: admin.cookie,
    });

    expect(noFaculty.status).toBe(404);
    expect(noUniversity.status).toBe(404);
    expect(await links(faculty.id)).toHaveLength(0);
  });

  test("unassign is refused with DIRECTORY_IN_USE naming the departments, and the link stays", async () => {
    const admin = await signedInAdmin();
    const department = await testApp().factories.department({ name: "Bengali" });
    await testApp().factories.department({
      name: "History",
      universityId: department.universityId,
      facultyId: department.facultyId,
    });
    const before = await testApp().database.prisma.auditLog.count();

    const reply = await call(
      "DELETE",
      `${base}/${department.facultyId}/universities/${department.universityId}`,
      { cookie: admin.cookie },
    );

    expect(reply.status).toBe(409);
    expect(errorOf(reply).code).toBe("DIRECTORY_IN_USE");
    expect(errorOf(reply).message).toContain("2 departments");
    expect(errorOf(reply).message).toContain("Bengali, History");
    expect(await links(department.facultyId)).toHaveLength(1);
    expect(await testApp().database.prisma.auditLog.count()).toBe(before);
  });

  test("unassigning a link with no departments removes it, and an unlinked pair is NOT_FOUND", async () => {
    const admin = await signedInAdmin();
    const university = await testApp().factories.university();
    const faculty = await testApp().factories.faculty();
    await testApp().database.prisma.universityFaculty.create({
      data: { universityId: university.id, facultyId: faculty.id },
    });
    const path = `${base}/${faculty.id}/universities/${university.id}`;

    const removed = await call("DELETE", path, { cookie: admin.cookie });
    const again = await call("DELETE", path, { cookie: admin.cookie });

    expect(removed.status).toBe(200);
    expect((removed.body as Faculty).universities).toEqual([]);
    expect(again.status).toBe(404);
    expect(await links(faculty.id)).toHaveLength(0);
  });

  test("the database foreign keys refuse removing a link that has departments or deleting a linked faculty", async () => {
    const department = await testApp().factories.department();

    await expect(
      testApp().database.prisma.$executeRawUnsafe(
        `DELETE FROM "UniversityFaculty" WHERE "universityId" = '${department.universityId}'::uuid AND "facultyId" = '${department.facultyId}'::uuid`,
      ),
    ).rejects.toThrow();
    await expect(
      testApp().database.prisma.$executeRawUnsafe(
        `DELETE FROM "Faculty" WHERE id = '${department.facultyId}'::uuid`,
      ),
    ).rejects.toThrow();
  });

  test("a name that exists, compared without case, is DIRECTORY_NAME_TAKEN on create and rename, and nothing is written", async () => {
    const admin = await signedInAdmin();
    await testApp().factories.faculty("Faculty of Arts");
    const other = await testApp().factories.faculty("Faculty of Science");
    const before = await testApp().database.prisma.auditLog.count();

    const create = await call("POST", base, {
      cookie: admin.cookie,
      body: { name: "faculty OF arts" },
    });
    const rename = await call("PATCH", `${base}/${other.id}`, {
      cookie: admin.cookie,
      body: { name: "FACULTY OF ARTS" },
    });

    expect(create.status).toBe(409);
    expect(errorOf(create).code).toBe("DIRECTORY_NAME_TAKEN");
    expect(rename.status).toBe(409);
    expect(errorOf(rename).code).toBe("DIRECTORY_NAME_TAKEN");
    expect(await testApp().database.prisma.faculty.count()).toBe(2);
    expect(await testApp().database.prisma.auditLog.count()).toBe(before);
  });

  test("renaming records the old and new name in the audit entry", async () => {
    const admin = await signedInAdmin();
    const faculty = await testApp().factories.faculty("Old Name");

    const reply = await call("PATCH", `${base}/${faculty.id}`, {
      cookie: admin.cookie,
      body: { name: "New Name" },
    });

    expect(reply.status).toBe(200);
    const audit = await testApp().database.prisma.auditLog.findFirstOrThrow({
      where: { entityId: faculty.id, action: "faculty.update" },
    });
    expect(audit).toMatchObject({ before: { name: "Old Name" }, after: { name: "New Name" } });
  });

  test("delete is refused with DIRECTORY_IN_USE while the faculty is linked to a university", async () => {
    const admin = await signedInAdmin();
    const university = await testApp().factories.university();
    const faculty = await testApp().factories.faculty();
    await testApp().database.prisma.universityFaculty.create({
      data: { universityId: university.id, facultyId: faculty.id },
    });

    const reply = await call("DELETE", `${base}/${faculty.id}`, { cookie: admin.cookie });

    expect(reply.status).toBe(409);
    expect(errorOf(reply).code).toBe("DIRECTORY_IN_USE");
    expect(errorOf(reply).message).toContain("1 university link");
    expect(await testApp().database.prisma.faculty.count({ where: { id: faculty.id } })).toBe(1);
  });

  test("delete is refused and counts students, a soft-deleted profile included", async () => {
    const admin = await signedInAdmin();
    const department = await testApp().factories.department();
    await testApp().factories.student({ departmentId: department.id });
    const { profile } = await testApp().factories.student({ departmentId: department.id });
    await testApp().database.prisma.studentProfile.update({
      where: { id: profile.id },
      data: { deletedAt: new Date() },
    });

    const reply = await call("DELETE", `${base}/${department.facultyId}`, {
      cookie: admin.cookie,
    });

    expect(reply.status).toBe(409);
    expect(errorOf(reply).code).toBe("DIRECTORY_IN_USE");
    expect(errorOf(reply).message).toContain("2 students");
  });

  test("an unreferenced faculty is deleted, disappears from the list and the delete is audited", async () => {
    const admin = await signedInAdmin();
    const faculty = await testApp().factories.faculty("Unused Faculty");

    const reply = await call("DELETE", `${base}/${faculty.id}`, { cookie: admin.cookie });

    expect(reply.status).toBe(204);
    const list = await call("GET", base, { cookie: admin.cookie });
    expect((list.body as Page).items.map((item) => item.id)).not.toContain(faculty.id);
    expect((await call("GET", `${base}/${faculty.id}`, { cookie: admin.cookie })).status).toBe(404);
    const audit = await testApp().database.prisma.auditLog.findFirstOrThrow({
      where: { entityId: faculty.id, action: "faculty.delete" },
    });
    expect(audit).toMatchObject({ actorId: admin.user.id, before: { name: "Unused Faculty" } });
  });

  test("the list reports student and department counts with soft-deleted profiles included", async () => {
    const admin = await signedInAdmin();
    const department = await testApp().factories.department();
    const { profile } = await testApp().factories.student({ departmentId: department.id });
    await testApp().factories.student({ departmentId: department.id });
    await testApp().database.prisma.studentProfile.update({
      where: { id: profile.id },
      data: { deletedAt: new Date() },
    });

    const reply = await call("GET", `${base}/${department.facultyId}`, { cookie: admin.cookie });
    const list = await call("GET", base, { cookie: admin.cookie });

    const expected = { studentCount: 2, departmentCount: 1 };
    expect(reply.body).toMatchObject(expected);
    expect(
      (list.body as Page).items.find((item) => item.id === department.facultyId),
    ).toMatchObject(expected);
  });

  test("the list is paged and sorted by name", async () => {
    const admin = await signedInAdmin();
    for (const name of ["Charlie", "Alpha", "Bravo"]) {
      await testApp().factories.faculty(name);
    }

    const reply = await call("GET", `${base}?pageSize=10&sort=-name`, { cookie: admin.cookie });

    expect((reply.body as Page).items.map((item) => item.name)).toEqual([
      "Charlie",
      "Bravo",
      "Alpha",
    ]);
  });

  test("a student session gets 403 on every faculty endpoint and an anonymous caller gets 401", async () => {
    const { user } = await testApp().factories.student();
    const tokens = await testApp().moduleRef.get(SessionService).create(user.id, "student");
    const cookie = `${realmCookies.student.access}=${tokens.accessToken}`;
    const faculty = await testApp().factories.faculty();
    const university = await testApp().factories.university();
    const id = faculty.id;
    const link = `${base}/${id}/universities/${university.id}`;

    const replies = await Promise.all([
      call("GET", base, { cookie }),
      call("GET", `${base}/${id}`, { cookie }),
      call("POST", base, { cookie, body: { name: "X" } }),
      call("PATCH", `${base}/${id}`, { cookie, body: { name: "X" } }),
      call("DELETE", `${base}/${id}`, { cookie }),
      call("PUT", link, { cookie }),
      call("DELETE", link, { cookie }),
    ]);

    expect(replies.map((reply) => reply.status)).toEqual([403, 403, 403, 403, 403, 403, 403]);
    expect((await call("GET", base)).status).toBe(401);
    expect((await call("PUT", link)).status).toBe(401);
  });
});
