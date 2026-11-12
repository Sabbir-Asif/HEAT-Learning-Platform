import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test } from "vitest";
import { QuizReviewQuestion } from "../src/composites/quiz-review-question";

afterEach(cleanup);

const options = [
  { id: "a", text: "Alpha" },
  { id: "b", text: "Bravo" },
];

const renderReview = (selectedOptionId: string | null, explanation: string | null) =>
  render(
    <QuizReviewQuestion
      number={1}
      text="Pick one"
      options={options}
      selectedOptionId={selectedOptionId}
      correctOptionId="a"
      explanation={explanation}
    />,
  );

describe("QuizReviewQuestion", () => {
  test("names the correct answer and the learner's wrong answer for assistive technology", () => {
    renderReview("b", "Alpha is right.");
    expect(screen.getByText("Alpha").parentElement?.textContent).toContain("(correct answer)");
    expect(screen.getByText("Bravo").parentElement?.textContent).toContain("(your answer)");
    expect(screen.getByText("Alpha is right.")).toBeTruthy();
  });

  test("renders no explanation when there is none", () => {
    renderReview("a", null);
    expect(screen.queryByText("Alpha is right.")).toBeNull();
  });
});
