import { describe, expect, test } from "vitest";
import { Redis } from "ioredis";
import { PasswordService } from "../../src/auth";
import { DIRECTORY_CACHE_REDIS } from "../../src/directory/directory-cache.redis";
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

describe("public directory lookups over HTTP", () => {
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

  const seed = async () => {
    const { factories, database } = testApp();
    const dhaka = await factories.university("University of Dhaka");
    const buet = await factories.university("BUET");
    const archivedUniversity = await factories.university("Archived University");
    await database.prisma.university.update({
      where: { id: archivedUniversity.id },
      data: { archivedAt: new Date() },
    });
    const science = await factories.faculty("Faculty of Science");
    const arts = await factories.faculty("Faculty of Arts");
    const archivedFaculty = await factories.faculty("Archived Faculty");
    await database.prisma.faculty.update({
      where: { id: archivedFaculty.id },
      data: { archivedAt: new Date() },
    });
    for (const faculty of [science, arts, archivedFaculty]) {
      await database.prisma.universityFaculty.create({
        data: { universityId: dhaka.id, facultyId: faculty.id },
      });
    }
    await database.prisma.universityFaculty.create({
      data: { universityId: archivedUniversity.id, facultyId: science.id },
    });
    const physics = await factories.department({
      name: "Physics",
      universityId: dhaka.id,
      facultyId: science.id,
    });
    await factories.department({
      name: "Chemistry",
      universityId: dhaka.id,
      facultyId: science.id,
    });
    const retired = await factories.department({
      name: "Retired",
      universityId: dhaka.id,
      facultyId: science.id,
    });
    await database.prisma.department.update({
      where: { id: retired.id },
      data: { archivedAt: new Date() },
    });
    await factories.department({
      name: "History",
      universityId: dhaka.id,
      facultyId: archivedFaculty.id,
    });
    return { dhaka, buet, archivedUniversity, science, arts, archivedFaculty, physics };
  };

  test("lists only active universities sorted by name, exposing id and name only, with a strong ETag that revalidates to 304", async () => {
    const { dhaka, buet } = await seed();

    const reply = await call("GET", "/directory/universities");

    expect(reply.status).toBe(200);
    expect(reply.body).toEqual({
      items: [
        { id: buet.id, name: "BUET" },
        { id: dhaka.id, name: "University of Dhaka" },
      ],
    });
    expect(reply.headers.get("cache-control")).toBe("no-cache");
    expect(reply.headers.get("etag")).toMatch(/^"/);

    const revalidated = await fetch(`${testApp().baseUrl}/api/directory/universities`, {
      headers: { "if-none-match": reply.headers.get("etag") ?? "" },
    });
    expect(revalidated.status).toBe(304);
  });

  test("lists only active faculties linked to the university, sorted by name", async () => {
    const { dhaka, buet } = await seed();

    const linked = await call("GET", `/directory/universities/${dhaka.id}/faculties`);
    const unlinked = await call("GET", `/directory/universities/${buet.id}/faculties`);

    expect(names(linked)).toEqual(["Faculty of Arts", "Faculty of Science"]);
    expect(unlinked.status).toBe(200);
    expect(unlinked.body).toEqual({ items: [] });
  });

  test("an archived university has no faculties and its departments are unreachable", async () => {
    const { archivedUniversity, science } = await seed();

    const faculties = await call(
      "GET",
      `/directory/universities/${archivedUniversity.id}/faculties`,
    );
    const departments = await call(
      "GET",
      `/directory/universities/${archivedUniversity.id}/faculties/${science.id}/departments`,
    );

    expect(faculties).toMatchObject({ status: 200, body: { items: [] } });
    expect(departments).toMatchObject({ status: 200, body: { items: [] } });
  });

  test("lists active departments for the pair, and is empty for an unlinked pair, an archived faculty or an unknown university", async () => {
    const { dhaka, buet, science, archivedFaculty } = await seed();
    const unknown = "0198f1a0-0000-7000-8000-00000000ffff";

    const active = await call(
      "GET",
      `/directory/universities/${dhaka.id}/faculties/${science.id}/departments`,
    );
    const unlinked = await call(
      "GET",
      `/directory/universities/${buet.id}/faculties/${science.id}/departments`,
    );
    const archived = await call(
      "GET",
      `/directory/universities/${dhaka.id}/faculties/${archivedFaculty.id}/departments`,
    );
    const missing = await call(
      "GET",
      `/directory/universities/${unknown}/faculties/${science.id}/departments`,
    );

    expect(names(active)).toEqual(["Chemistry", "Physics"]);
    for (const reply of [unlinked, archived, missing]) {
      expect(reply).toMatchObject({ status: 200, body: { items: [] } });
    }
  });

  test("a malformed id is 400 with the stable validation code", async () => {
    const { science } = await seed();

    const faculties = await call("GET", "/directory/universities/not-an-id/faculties");
    const departments = await call(
      "GET",
      `/directory/universities/${science.id}/faculties/arts/departments`,
    );

    expect(faculties.status).toBe(400);
    expect(errorCode(faculties)).toBe("VALIDATION_FAILED");
    expect(departments.status).toBe(400);
    expect(errorCode(departments)).toBe("VALIDATION_FAILED");
  });

  test("a repeated lookup is served from the cache without reading PostgreSQL", async () => {
    const { dhaka } = await seed();
    await call("GET", "/directory/universities");

    await testApp().database.prisma.university.update({
      where: { id: dhaka.id },
      data: { name: "Renamed Behind The Cache" },
    });
    const second = await call("GET", "/directory/universities");

    expect(names(second)).toContain("University of Dhaka");
    expect(names(second)).not.toContain("Renamed Behind The Cache");
  });

  test("an empty answer is cached briefly, and a write still makes the next lookup fresh", async () => {
    const cookie = await signedInAdmin();
    expect(names(await call("GET", "/directory/universities"))).toEqual([]);

    await testApp().factories.university("Behind The Cache");
    expect(names(await call("GET", "/directory/universities"))).toEqual([]);

    const created = await call("POST", "/admin/directory/universities", {
      cookie,
      body: { name: "Fresh University" },
    });
    const next = await call("GET", "/directory/universities");

    expect(created.status).toBe(201);
    expect(names(next)).toEqual(["Behind The Cache", "Fresh University"]);
  });

  test("renaming a university through the admin API shows in the next lookup", async () => {
    const { dhaka } = await seed();
    const cookie = await signedInAdmin();
    await call("GET", "/directory/universities");

    const renamed = await call("PATCH", `/admin/directory/universities/${dhaka.id}`, {
      cookie,
      body: { name: "Dhaka University" },
    });
    const next = await call("GET", "/directory/universities");

    expect(renamed.status).toBe(200);
    expect(names(next)).toContain("Dhaka University");
    expect(names(next)).not.toContain("University of Dhaka");
  });

  test("creating and deleting a university through the admin API shows in the next lookup", async () => {
    await seed();
    const cookie = await signedInAdmin();
    await call("GET", "/directory/universities");

    const created = await call("POST", "/admin/directory/universities", {
      cookie,
      body: { name: "Aaa New University" },
    });
    const afterCreate = await call("GET", "/directory/universities");
    const id = (created.body as { id: string }).id;
    const removed = await call("DELETE", `/admin/directory/universities/${id}`, { cookie });
    const afterDelete = await call("GET", "/directory/universities");

    expect(created.status).toBe(201);
    expect(names(afterCreate)[0]).toBe("Aaa New University");
    expect(removed.status).toBe(204);
    expect(names(afterDelete)).not.toContain("Aaa New University");
  });

  test("faculty create, rename, assign, unassign and delete each show in the next lookup", async () => {
    const { buet } = await seed();
    const cookie = await signedInAdmin();
    const lookup = () => call("GET", `/directory/universities/${buet.id}/faculties`);
    await lookup();

    const created = await call("POST", "/admin/directory/faculties", {
      cookie,
      body: { name: "Faculty of Law" },
    });
    const id = (created.body as { id: string }).id;
    expect(names(await lookup())).toEqual([]);

    const assigned = await call("PUT", `/admin/directory/faculties/${id}/universities/${buet.id}`, {
      cookie,
    });
    expect(assigned.status).toBe(200);
    expect(names(await lookup())).toEqual(["Faculty of Law"]);

    await call("PATCH", `/admin/directory/faculties/${id}`, {
      cookie,
      body: { name: "Faculty of Jurisprudence" },
    });
    expect(names(await lookup())).toEqual(["Faculty of Jurisprudence"]);

    const unassigned = await call(
      "DELETE",
      `/admin/directory/faculties/${id}/universities/${buet.id}`,
      { cookie },
    );
    expect(unassigned.status).toBe(200);
    expect(names(await lookup())).toEqual([]);

    const removed = await call("DELETE", `/admin/directory/faculties/${id}`, { cookie });
    expect(removed.status).toBe(204);
  });

  test("department create, rename and delete each show in the next lookup", async () => {
    const { dhaka, science } = await seed();
    const cookie = await signedInAdmin();
    const lookup = () =>
      call("GET", `/directory/universities/${dhaka.id}/faculties/${science.id}/departments`);
    await lookup();

    const created = await call("POST", "/admin/directory/departments", {
      cookie,
      body: { name: "Astronomy", universityId: dhaka.id, facultyId: science.id },
    });
    const id = (created.body as { id: string }).id;
    expect(names(await lookup())).toEqual(["Astronomy", "Chemistry", "Physics"]);

    await call("PATCH", `/admin/directory/departments/${id}`, {
      cookie,
      body: { name: "Zoology", universityId: dhaka.id, facultyId: science.id },
    });
    expect(names(await lookup())).toEqual(["Chemistry", "Physics", "Zoology"]);

    const removed = await call("DELETE", `/admin/directory/departments/${id}`, { cookie });
    expect(removed.status).toBe(204);
    expect(names(await lookup())).toEqual(["Chemistry", "Physics"]);
  });

  test("a refused admin write leaves the cache in place", async () => {
    const { dhaka } = await seed();
    const cookie = await signedInAdmin();
    await call("GET", "/directory/universities");
    await testApp().database.prisma.university.update({
      where: { id: dhaka.id },
      data: { name: "Renamed Behind The Cache" },
    });

    const refused = await call("PATCH", `/admin/directory/universities/${dhaka.id}`, {
      cookie,
      body: { name: "BUET" },
    });
    const next = await call("GET", "/directory/universities");

    expect(refused.status).toBe(409);
    expect(names(next)).toContain("University of Dhaka");
  });

  test("falls back to PostgreSQL instead of failing when Redis cannot be reached", async () => {
    const { buet } = await seed();
    testApp().moduleRef.get<Redis>(DIRECTORY_CACHE_REDIS, { strict: false }).disconnect();

    const reply = await call("GET", "/directory/universities");

    expect(reply.status).toBe(200);
    expect(names(reply)).toContain(buet.name);
  });
});
