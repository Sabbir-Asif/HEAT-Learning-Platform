import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test } from "vitest";
import { QuizPreview } from "../src/composites/quiz-preview";

afterEach(cleanup);

const questions = [
  {
    id: "q1",
    text: "Pick one",
    explanation: "Because.",
    options: [
      { id: "a", text: "Alpha", isCorrect: false },
      { id: "b", text: "Bravo", isCorrect: true },
    ],
  },
];

describe("QuizPreview", () => {
  test("marks only the correct option", () => {
    render(<QuizPreview questions={questions} />);
    expect(screen.getAllByText("Correct answer")).toHaveLength(1);
    expect(screen.getByText("Bravo").closest("li")?.getAttribute("data-correct")).toBe("true");
    expect(screen.getByText("Alpha").closest("li")?.getAttribute("data-correct")).toBe("false");
  });

  test("shows the position and the explanation", () => {
    render(<QuizPreview questions={questions} />);
    expect(screen.getByText("Question 1 of 1")).toBeTruthy();
    expect(screen.getByText("Because.")).toBeTruthy();
  });
});
