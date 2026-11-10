import { findUserIdsByEmail } from "@heat/db";
import { describe, expect, test } from "vitest";
import { useTestApp } from "../support/testing-module";

describe("email lookup on real Postgres", () => {
  const testApp = useTestApp();
  const lookup = (email: string) => findUserIdsByEmail(testApp().database.prisma, email);

  test("underscore and percent are not wildcards", async () => {
    await testApp().factories.user({ email: "admin@x.com" });
    await testApp().factories.user({ email: "aXb@x.com" });

    expect(await lookup("_dmin@x.com")).toEqual([]);
    expect(await lookup("a%@x.com")).toEqual([]);
    expect(await lookup("a_b@x.com")).toEqual([]);
    expect(await lookup("%@x.com")).toEqual([]);
  });

  test("matches exactly, ignoring case and surrounding spaces", async () => {
    const admin = await testApp().factories.user({ email: "Admin@x.com" });
    const other = await testApp().factories.user({ email: "aXb@x.com" });

    expect(await lookup("  ADMIN@x.com ")).toEqual([admin.id]);
    expect(await lookup("axb@X.COM")).toEqual([other.id]);
  });

  test("skips soft deleted users", async () => {
    const gone = await testApp().factories.user({ email: "gone@x.com" });
    await testApp().database.prisma.user.update({
      where: { id: gone.id },
      data: { deletedAt: new Date() },
    });

    expect(await lookup("gone@x.com")).toEqual([]);
  });
});
