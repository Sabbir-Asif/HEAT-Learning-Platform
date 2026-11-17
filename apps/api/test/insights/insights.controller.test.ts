import { describe, expect, test, vi } from "vitest";
import { AUDIENCE_KEY, ROLES_KEY } from "../../src/access/access.decorators";
import { AUDITED_KEY } from "../../src/audit/audited.decorator";
import { InsightsController } from "../../src/insights/insights.controller";

describe("InsightsController", () => {
  test("every route is admin only", () => {
    expect(Reflect.getMetadata(AUDIENCE_KEY, InsightsController)).toBe("admin");
    expect(Reflect.getMetadata(ROLES_KEY, InsightsController)).toEqual(["ADMIN", "SUPER_ADMIN"]);
  });

  test("the refresh is audited and answers 202", () => {
    expect(Reflect.getMetadata(AUDITED_KEY, InsightsController.prototype.refresh)).toEqual({
      action: "insights.refresh",
      entity: "InsightRun",
    });
    expect(Reflect.getMetadata("__httpCode__", InsightsController.prototype.refresh)).toBe(202);
  });

  test("the csv route sets the download headers and returns the text", async () => {
    const csv = vi.fn().mockResolvedValue("group,registered,suppressed\r\n");
    const controller = new InsightsController({ csv } as never, {} as never);
    const setHeader = vi.fn();
    const body = await controller.csv({ series: "enrollments" }, { groupBy: "day" }, { setHeader });
    expect(body).toBe("group,registered,suppressed\r\n");
    expect(csv).toHaveBeenCalledWith("enrollments", { groupBy: "day" });
    expect(setHeader).toHaveBeenCalledWith("Content-Type", "text/csv; charset=utf-8");
    expect(setHeader).toHaveBeenCalledWith(
      "Content-Disposition",
      'attachment; filename="insights-enrollments.csv"',
    );
  });

  test("the funnel route passes the filters to the query service", async () => {
    const funnel = vi.fn().mockResolvedValue({ stages: [] });
    const controller = new InsightsController({ funnel } as never, {} as never);
    await controller.funnel({ courseId: "c" });
    expect(funnel).toHaveBeenCalledWith({ courseId: "c" });
  });

  test("the refresh passes the signed in admin", async () => {
    const refresh = vi.fn().mockResolvedValue({ run: {} });
    const controller = new InsightsController({} as never, { refresh } as never);
    await controller.refresh({ userId: "admin-1" } as never);
    expect(refresh).toHaveBeenCalledWith("admin-1");
  });

  test("the module, quiz and missed question routes pass the query to the service", async () => {
    const moduleResults = vi.fn().mockResolvedValue({ rows: [] });
    const quizResults = vi.fn().mockResolvedValue({ rows: [] });
    const missedQuestions = vi.fn().mockResolvedValue({ rows: [] });
    const controller = new InsightsController(
      { moduleResults, quizResults, missedQuestions } as never,
      {} as never,
    );
    await controller.moduleResults({ courseId: "c" });
    await controller.quizResults({ session: "2020-21" });
    await controller.missedQuestions({ quizId: "q", limit: 5 });
    expect(moduleResults).toHaveBeenCalledWith({ courseId: "c" });
    expect(quizResults).toHaveBeenCalledWith({ session: "2020-21" });
    expect(missedQuestions).toHaveBeenCalledWith({ quizId: "q", limit: 5 });
  });
});
