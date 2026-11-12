import { describe, expect, test } from "vitest";
import { CourseHome } from "../../src/learn/course-home";
import { makeModule, makeStructure, uuid } from "./fixtures";
import { mount } from "./mount";

describe("CourseHome", () => {
  test("each module shows the state returned by the API", async () => {
    const states = ["COMPLETED", "QUIZ_READY", "IN_PROGRESS", "UNLOCKED", "LOCKED"] as const;
    const view = await mount(
      <CourseHome
        response={makeStructure(states.map((state, index) => makeModule(index + 1, { state })))}
      />,
    );

    const badges = [...view.querySelectorAll("[data-state]")].map((node) => [
      node.getAttribute("data-state"),
      node.textContent,
    ]);

    expect(badges).toEqual([
      ["COMPLETED", "Completed"],
      ["QUIZ_READY", "Quiz ready"],
      ["IN_PROGRESS", "In progress"],
      ["UNLOCKED", "Unlocked"],
      ["LOCKED", "Locked"],
    ]);
  });

  test("a locked module has no link and says what unlocks it", async () => {
    const view = await mount(
      <CourseHome
        response={makeStructure([
          makeModule(1, { state: "IN_PROGRESS", title: "Basics" }),
          makeModule(2, { state: "LOCKED" }),
        ])}
      />,
    );

    expect(view.querySelector(`a[href$="${uuid(2)}"]`)).toBeNull();
    expect(view.querySelector(`a[href="/learn/heat/${uuid(1)}"]`)).not.toBeNull();
    expect(view.textContent).toContain('Finish "Basics" and pass its quiz to open this module.');
  });

  test("shows the watch progress and the quiz state of an open module", async () => {
    const view = await mount(
      <CourseHome
        response={makeStructure([
          makeModule(1, { state: "IN_PROGRESS", requiredVideosCompleted: 1 }),
        ])}
      />,
    );

    expect(view.textContent).toContain("1 of 2 required videos watched");
    expect(view.querySelector('[role="progressbar"]')).not.toBeNull();
    expect(view.textContent).toContain(
      "Watch 1 more required video to at least 80% to unlock the quiz.",
    );
  });

  test("shows overall progress and a continue link to the next module", async () => {
    const view = await mount(
      <CourseHome response={makeStructure([makeModule(1), makeModule(2, { state: "LOCKED" })])} />,
    );

    expect(view.textContent).toContain("1 of 2 modules completed");
    expect(view.querySelector(`a[href="/learn/heat/${uuid(1)}"]`)?.textContent).toContain(
      "Continue learning",
    );
  });

  test("a course with no modules shows an empty state", async () => {
    const view = await mount(<CourseHome response={makeStructure([])} />);

    expect(view.textContent).toContain("No modules yet");
  });

  test.each([
    ["PENDING_APPROVAL", null, "An administrator is reviewing your request."],
    ["REMOVED", "Left the university", "Your access to this course was removed."],
    ["REJECTED", "Not eligible", "Your request was not approved."],
  ] as const)(
    "a %s enrollment shows its status and no content",
    async (status, reason, description) => {
      const view = await mount(
        <CourseHome
          response={makeStructure([makeModule(1, { title: "Secret module" })], {
            enrollment: { status, reason },
            learning: null,
          })}
        />,
      );

      expect(view.textContent).toContain(description);
      if (reason !== null) expect(view.textContent).toContain(`Reason: ${reason}`);
      expect(view.textContent).not.toContain("Secret module");
      expect(view.querySelector('a[href^="/learn/"]')).toBeNull();
    },
  );
});
