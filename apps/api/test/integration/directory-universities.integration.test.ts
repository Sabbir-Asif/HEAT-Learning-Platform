import { describe, expect, test } from "vitest";
import { PasswordService, SessionService, realmCookies } from "../../src/auth";
import { csrfHeaders } from "../support/csrf";
import { useTestApp } from "../support/testing-module";

const password = "correct horse battery staple";

interface Reply {
  status: number;
  body: unknown;
}

interface University {
  id: string;
  name: string;
  studentCount: number;
  departmentCount: number;
  facultyCount: number;
}

interface Page {
  items: University[];
  total: number;
}

const cookieHeader = (setCookies: string[]): string =>
  setCookies
    .map((line) => line.split(";")[0] ?? "")
    .filter((pair) => !pair.endsWith("="))
    .join("; ");

const errorOf = (reply: Reply): { code: string; message: string } =>
  (reply.body as { error: { code: string; message: string } }).error;

describe("university directory over HTTP", () => {
  const testApp = useTestApp();

  const call = async (
    method: "GET" | "POST" | "PATCH" | "DELETE",
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

  const base = "/admin/directory/universities";

  test("create then list shows the university and writes an audit entry with the actor and new values", async () => {
    const admin = await signedInAdmin();

    const created = await call("POST", base, {
      cookie: admin.cookie,
      body: { name: "  North   South University " },
    });

    expect(created.status).toBe(201);
    const university = created.body as University;
    expect(university).toMatchObject({ name: "North South University", studentCount: 0 });
    const list = await call("GET", `${base}?q=north`, { cookie: admin.cookie });
    expect((list.body as Page).items.map((item) => item.id)).toEqual([university.id]);
    const audit = await testApp().database.prisma.auditLog.findFirstOrThrow({
      where: { entityId: university.id },
    });
    expect(audit).toMatchObject({
      actorId: admin.user.id,
      action: "university.create",
      entity: "University",
      after: { name: "North South University" },
    });
  });

  test("a name that exists, compared without case, is DIRECTORY_NAME_TAKEN on create and rename, and nothing is written", async () => {
    const admin = await signedInAdmin();
    await testApp().factories.university("University of Dhaka");
    const other = await testApp().factories.university("BUET");
    const before = await testApp().database.prisma.auditLog.count();

    const create = await call("POST", base, {
      cookie: admin.cookie,
      body: { name: "university OF dhaka" },
    });
    const rename = await call("PATCH", `${base}/${other.id}`, {
      cookie: admin.cookie,
      body: { name: "UNIVERSITY OF DHAKA" },
    });

    expect(create.status).toBe(409);
    expect(errorOf(create).code).toBe("DIRECTORY_NAME_TAKEN");
    expect(rename.status).toBe(409);
    expect(errorOf(rename).code).toBe("DIRECTORY_NAME_TAKEN");
    expect(await testApp().database.prisma.university.count()).toBe(2);
    expect(await testApp().database.prisma.auditLog.count()).toBe(before);
  });

  test("renaming records the old and new name in the audit entry", async () => {
    const admin = await signedInAdmin();
    const university = await testApp().factories.university("Old Name");

    const reply = await call("PATCH", `${base}/${university.id}`, {
      cookie: admin.cookie,
      body: { name: "New Name" },
    });

    expect(reply.status).toBe(200);
    const audit = await testApp().database.prisma.auditLog.findFirstOrThrow({
      where: { entityId: university.id, action: "university.update" },
    });
    expect(audit).toMatchObject({ before: { name: "Old Name" }, after: { name: "New Name" } });
  });

  test("delete is refused with DIRECTORY_IN_USE and the student count while a student profile references it", async () => {
    const admin = await signedInAdmin();
    const department = await testApp().factories.department();
    await testApp().factories.student({ departmentId: department.id });
    await testApp().factories.student({ departmentId: department.id });

    const reply = await call("DELETE", `${base}/${department.universityId}`, {
      cookie: admin.cookie,
    });

    expect(reply.status).toBe(409);
    expect(errorOf(reply).code).toBe("DIRECTORY_IN_USE");
    expect(errorOf(reply).message).toContain("2 students");
    expect(
      await testApp().database.prisma.university.count({ where: { id: department.universityId } }),
    ).toBe(1);
  });

  test("a soft-deleted student profile that still exists still blocks the delete", async () => {
    const admin = await signedInAdmin();
    const department = await testApp().factories.department();
    const { profile } = await testApp().factories.student({ departmentId: department.id });
    await testApp().database.prisma.studentProfile.update({
      where: { id: profile.id },
      data: { deletedAt: new Date() },
    });

    const reply = await call("DELETE", `${base}/${department.universityId}`, {
      cookie: admin.cookie,
    });

    expect(reply.status).toBe(409);
    expect(errorOf(reply).message).toContain("1 student");
  });

  test("a university with departments but no students is refused", async () => {
    const admin = await signedInAdmin();
    const department = await testApp().factories.department();

    const reply = await call("DELETE", `${base}/${department.universityId}`, {
      cookie: admin.cookie,
    });

    expect(reply.status).toBe(409);
    expect(errorOf(reply).code).toBe("DIRECTORY_IN_USE");
  });

  test("an unreferenced university is deleted, disappears from the list and the delete is audited", async () => {
    const admin = await signedInAdmin();
    const university = await testApp().factories.university("Unused University");

    const reply = await call("DELETE", `${base}/${university.id}`, { cookie: admin.cookie });

    expect(reply.status).toBe(204);
    const list = await call("GET", base, { cookie: admin.cookie });
    expect((list.body as Page).items.map((item) => item.id)).not.toContain(university.id);
    expect((await call("GET", `${base}/${university.id}`, { cookie: admin.cookie })).status).toBe(
      404,
    );
    const audit = await testApp().database.prisma.auditLog.findFirstOrThrow({
      where: { entityId: university.id, action: "university.delete" },
    });
    expect(audit).toMatchObject({ actorId: admin.user.id, before: { name: "Unused University" } });
  });

  test("the database foreign keys refuse the delete even when the service check is bypassed", async () => {
    const department = await testApp().factories.department();
    await testApp().factories.student({ departmentId: department.id });

    await expect(
      testApp().database.prisma.$executeRawUnsafe(
        `DELETE FROM "University" WHERE id = '${department.universityId}'::uuid`,
      ),
    ).rejects.toThrow();
    await expect(
      testApp().database.prisma.$executeRawUnsafe(
        `DELETE FROM "Department" WHERE id = '${department.id}'::uuid`,
      ),
    ).rejects.toThrow();
  });

  test("a student session gets 403 on every directory endpoint and an anonymous caller gets 401", async () => {
    const { user } = await testApp().factories.student();
    const tokens = await testApp().moduleRef.get(SessionService).create(user.id, "student");
    const cookie = `${realmCookies.student.access}=${tokens.accessToken}`;
    const university = await testApp().factories.university();
    const id = university.id;

    const replies = await Promise.all([
      call("GET", base, { cookie }),
      call("GET", `${base}/${id}`, { cookie }),
      call("POST", base, { cookie, body: { name: "X" } }),
      call("PATCH", `${base}/${id}`, { cookie, body: { name: "X" } }),
      call("DELETE", `${base}/${id}`, { cookie }),
    ]);

    expect(replies.map((reply) => reply.status)).toEqual([403, 403, 403, 403, 403]);
    expect((await call("GET", base)).status).toBe(401);
  });

  test("the list reports student, department and faculty counts, soft-deleted profiles included", async () => {
    const admin = await signedInAdmin();
    const department = await testApp().factories.department();
    const { profile } = await testApp().factories.student({ departmentId: department.id });
    await testApp().factories.student({ departmentId: department.id });
    await testApp().database.prisma.studentProfile.update({
      where: { id: profile.id },
      data: { deletedAt: new Date() },
    });

    const reply = await call("GET", `${base}/${department.universityId}`, { cookie: admin.cookie });
    const list = await call("GET", base, { cookie: admin.cookie });

    const expected = { studentCount: 2, departmentCount: 1, facultyCount: 1 };
    expect(reply.body).toMatchObject(expected);
    expect(
      (list.body as Page).items.find((item) => item.id === department.universityId),
    ).toMatchObject(expected);
  });

  test("the list is paged and sorted by name", async () => {
    const admin = await signedInAdmin();
    for (const name of ["Charlie", "Alpha", "Bravo"]) {
      await testApp().factories.university(name);
    }

    const reply = await call("GET", `${base}?pageSize=10&sort=-name`, { cookie: admin.cookie });

    expect((reply.body as Page).items.map((item) => item.name)).toEqual([
      "Charlie",
      "Bravo",
      "Alpha",
    ]);
  });
});
