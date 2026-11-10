import { describe, expect, test } from "vitest";
import { PasswordService } from "../../src/auth";
import { DepartmentOfferingService } from "../../src/directory/department-offering.service";
import { csrfHeaders } from "../support/csrf";
import { useTestApp } from "../support/testing-module";

const password = "correct horse battery staple";

interface Reply {
  status: number;
  body: unknown;
  headers: Headers;
}

interface Options {
  items: Array<{ id: string; name: string }>;
}

const cookieHeader = (setCookies: string[]): string =>
  setCookies
    .map((line) => line.split(";")[0] ?? "")
    .filter((pair) => !pair.endsWith("="))
    .join("; ");

const names = (reply: Reply): string[] => (reply.body as Options).items.map((item) => item.name);

const errorCode = (reply: Reply): string => (reply.body as { error: { code: string } }).error.code;

describe("archive and restore of directory records over HTTP", () => {
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
    return {
      status: response.status,
      body: text === "" ? undefined : JSON.parse(text),
      headers: response.headers,
    };
  };

  const signedInAdmin = async (): Promise<string> => {
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
    return cookieHeader(response.headers.getSetCookie());
  };

  const admin = "/admin/directory";

  const universityOptions = async () => names(await call("GET", "/directory/universities"));

  const facultyOptions = async (universityId: string) =>
    names(await call("GET", `/directory/universities/${universityId}/faculties`));

  const departmentOptions = async (universityId: string, facultyId: string) =>
    names(
      await call(
        "GET",
        `/directory/universities/${universityId}/faculties/${facultyId}/departments`,
      ),
    );

  const seed = async () => {
    const { factories, database } = testApp();
    const university = await factories.university("University of Dhaka");
    const faculty = await factories.faculty("Faculty of Arts");
    await database.prisma.universityFaculty.create({
      data: { universityId: university.id, facultyId: faculty.id },
    });
    const department = await factories.department({
      name: "Bengali",
      universityId: university.id,
      facultyId: faculty.id,
    });
    return { university, faculty, department };
  };

  const auditOf = (entityId: string, action: string) =>
    testApp().database.prisma.auditLog.findFirstOrThrow({ where: { entityId, action } });

  test("archiving a department hides it from lookups only, keeps its students, audits it and restoring brings it back", async () => {
    const cookie = await signedInAdmin();
    const { university, faculty, department } = await seed();
    await testApp().factories.student({ departmentId: department.id });
    expect(await departmentOptions(university.id, faculty.id)).toEqual(["Bengali"]);

    const archived = await call("POST", `${admin}/departments/${department.id}/archive`, {
      cookie,
    });

    expect(archived.status).toBe(200);
    expect(archived.body).toMatchObject({ name: "Bengali", studentCount: 1 });
    expect((archived.body as { archivedAt: string | null }).archivedAt).not.toBeNull();
    expect(await departmentOptions(university.id, faculty.id)).toEqual([]);
    const fetched = await call("GET", `${admin}/departments/${department.id}`, { cookie });
    expect(fetched.body).toMatchObject({ name: "Bengali", studentCount: 1 });
    expect(await auditOf(department.id, "department.archive")).toMatchObject({
      entity: "Department",
      before: { name: "Bengali", archived: false },
      after: { name: "Bengali", archived: true },
    });

    const restored = await call("POST", `${admin}/departments/${department.id}/restore`, {
      cookie,
    });

    expect(restored.status).toBe(200);
    expect((restored.body as { archivedAt: string | null }).archivedAt).toBeNull();
    expect(await departmentOptions(university.id, faculty.id)).toEqual(["Bengali"]);
    expect(await auditOf(department.id, "department.restore")).toMatchObject({
      before: { archived: true },
      after: { archived: false },
    });
  });

  test("archiving is idempotent and an unknown id is NOT_FOUND", async () => {
    const cookie = await signedInAdmin();
    const { department } = await seed();
    const path = `${admin}/departments/${department.id}/archive`;

    const first = await call("POST", path, { cookie });
    const second = await call("POST", path, { cookie });

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect((second.body as { archivedAt: string }).archivedAt).toBe(
      (first.body as { archivedAt: string }).archivedAt,
    );
    const missing = await call(
      "POST",
      `${admin}/departments/0198f1a0-0000-7000-8000-00000000dead/archive`,
      { cookie },
    );
    expect(missing.status).toBe(404);
    expect(errorCode(missing)).toBe("NOT_FOUND");
  });

  test("archiving a university hides it and everything under it from lookups without touching the departments' own flags, and restoring brings it all back", async () => {
    const cookie = await signedInAdmin();
    const { university, faculty, department } = await seed();

    const archived = await call("POST", `${admin}/universities/${university.id}/archive`, {
      cookie,
    });

    expect(archived.status).toBe(200);
    expect(await universityOptions()).toEqual([]);
    expect(await facultyOptions(university.id)).toEqual([]);
    expect(await departmentOptions(university.id, faculty.id)).toEqual([]);
    const row = await testApp().database.prisma.department.findUniqueOrThrow({
      where: { id: department.id },
    });
    expect(row.archivedAt).toBeNull();
    expect(await auditOf(university.id, "university.archive")).toMatchObject({
      before: { archived: false },
      after: { archived: true },
    });

    await call("POST", `${admin}/universities/${university.id}/restore`, { cookie });

    expect(await universityOptions()).toEqual(["University of Dhaka"]);
    expect(await facultyOptions(university.id)).toEqual(["Faculty of Arts"]);
    expect(await departmentOptions(university.id, faculty.id)).toEqual(["Bengali"]);
  });

  test("archiving a faculty hides its departments from lookups only and restoring brings them back", async () => {
    const cookie = await signedInAdmin();
    const { university, faculty, department } = await seed();

    const archived = await call("POST", `${admin}/faculties/${faculty.id}/archive`, { cookie });

    expect(archived.status).toBe(200);
    expect(await facultyOptions(university.id)).toEqual([]);
    expect(await departmentOptions(university.id, faculty.id)).toEqual([]);
    const row = await testApp().database.prisma.department.findUniqueOrThrow({
      where: { id: department.id },
    });
    expect(row.archivedAt).toBeNull();
    expect(await auditOf(faculty.id, "faculty.archive")).toMatchObject({
      after: { archived: true },
    });

    await call("POST", `${admin}/faculties/${faculty.id}/restore`, { cookie });

    expect(await facultyOptions(university.id)).toEqual(["Faculty of Arts"]);
    expect(await departmentOptions(university.id, faculty.id)).toEqual(["Bengali"]);
  });

  test("an archived faculty cannot be assigned to a university nor given a department, and the same holds for an archived university", async () => {
    const cookie = await signedInAdmin();
    const { university, faculty } = await seed();
    const other = await testApp().factories.university("BUET");
    await call("POST", `${admin}/faculties/${faculty.id}/archive`, { cookie });

    const assign = await call("PUT", `${admin}/faculties/${faculty.id}/universities/${other.id}`, {
      cookie,
    });
    const create = await call("POST", `${admin}/departments`, {
      cookie,
      body: { name: "History", universityId: university.id, facultyId: faculty.id },
    });

    expect(assign.status).toBe(409);
    expect(errorCode(assign)).toBe("DIRECTORY_ARCHIVED");
    expect(create.status).toBe(409);
    expect(errorCode(create)).toBe("DIRECTORY_ARCHIVED");
    const links = await testApp().database.prisma.universityFaculty.count({
      where: { facultyId: faculty.id },
    });
    expect(links).toBe(1);
    expect(await testApp().database.prisma.department.count({ where: { name: "History" } })).toBe(
      0,
    );

    await call("POST", `${admin}/faculties/${faculty.id}/restore`, { cookie });
    await call("POST", `${admin}/universities/${university.id}/archive`, { cookie });

    const underUniversity = await call("POST", `${admin}/departments`, {
      cookie,
      body: { name: "History", universityId: university.id, facultyId: faculty.id },
    });
    const assignToArchived = await call(
      "PUT",
      `${admin}/faculties/${faculty.id}/universities/${university.id}`,
      { cookie },
    );

    expect(errorCode(underUniversity)).toBe("DIRECTORY_ARCHIVED");
    expect(errorCode(assignToArchived)).toBe("DIRECTORY_ARCHIVED");
  });

  test("an existing department can still be renamed under an archived faculty and keeps its students", async () => {
    const cookie = await signedInAdmin();
    const { university, faculty, department } = await seed();
    await call("POST", `${admin}/faculties/${faculty.id}/archive`, { cookie });

    const renamed = await call("PATCH", `${admin}/departments/${department.id}`, {
      cookie,
      body: { name: "Bangla", universityId: university.id, facultyId: faculty.id },
    });

    expect(renamed.status).toBe(200);
    expect(renamed.body).toMatchObject({ name: "Bangla" });
  });

  test("the admin lists default to active records and filter by archived or all in every table", async () => {
    const cookie = await signedInAdmin();
    const { faculty, department } = await seed();
    const retired = await testApp().factories.university("Retired University");
    await call("POST", `${admin}/universities/${retired.id}/archive`, { cookie });
    await call("POST", `${admin}/faculties/${faculty.id}/archive`, { cookie });
    await call("POST", `${admin}/departments/${department.id}/archive`, { cookie });

    const universityNames = async (status: string) =>
      (
        (await call("GET", `${admin}/universities?status=${status}`, { cookie })).body as {
          items: Array<{ name: string }>;
        }
      ).items.map((item) => item.name);
    const defaulted = (await call("GET", `${admin}/universities`, { cookie })).body as {
      items: Array<{ name: string }>;
    };

    expect(defaulted.items.map((item) => item.name)).toEqual(["University of Dhaka"]);
    expect(await universityNames("archived")).toEqual(["Retired University"]);
    expect(await universityNames("all")).toEqual(["Retired University", "University of Dhaka"]);
    const faculties = async (status: string) =>
      (
        (await call("GET", `${admin}/faculties?status=${status}`, { cookie })).body as {
          items: Array<{ name: string }>;
        }
      ).items.map((item) => item.name);
    expect(await faculties("active")).toEqual([]);
    expect(await faculties("archived")).toEqual(["Faculty of Arts"]);
    const departments = async (status: string) =>
      (
        (await call("GET", `${admin}/departments?status=${status}`, { cookie })).body as {
          items: Array<{ name: string }>;
        }
      ).items.map((item) => item.name);
    expect(await departments("active")).toEqual([]);
    expect(await departments("archived")).toEqual(["Bengali"]);
    const invalid = await call("GET", `${admin}/universities?status=deleted`, { cookie });
    expect(invalid.status).toBe(400);
  });

  test("archive and restore need an admin session", async () => {
    const { department } = await seed();

    const reply = await call("POST", `${admin}/departments/${department.id}/archive`);

    expect(reply.status).toBe(401);
  });

  describe("submit-time validation of the chosen department", () => {
    const offering = () => testApp().moduleRef.get(DepartmentOfferingService);

    test("an active department is offerable", async () => {
      const { department } = await seed();

      await expect(offering().assertDepartmentOfferable(department.id)).resolves.toBeUndefined();
    });

    test.each([
      ["the department itself", "departments"],
      ["its faculty", "faculties"],
      ["its university", "universities"],
    ] as const)(
      "a department whose %s was archived after the page loaded is refused with a field error on departmentId",
      async (_label, kind) => {
        const cookie = await signedInAdmin();
        const { university, faculty, department } = await seed();
        const ids = {
          departments: department.id,
          faculties: faculty.id,
          universities: university.id,
        };
        await call("POST", `${admin}/${kind}/${ids[kind]}/archive`, { cookie });

        const failure = await offering()
          .assertDepartmentOfferable(department.id)
          .catch((error: unknown) => error);

        expect(failure).toMatchObject({
          code: "VALIDATION_FAILED",
          fields: [{ path: "departmentId", code: "invalid_value" }],
        });

        await call("POST", `${admin}/${kind}/${ids[kind]}/restore`, { cookie });

        await expect(offering().assertDepartmentOfferable(department.id)).resolves.toBeUndefined();
      },
    );

    test("an unknown department is refused the same way", async () => {
      await expect(
        offering().assertDepartmentOfferable("0198f1a0-0000-7000-8000-00000000dead"),
      ).rejects.toMatchObject({ code: "VALIDATION_FAILED" });
    });
  });
});
