import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { QuizQuestion } from "../src/composites/quiz-question";

afterEach(cleanup);

const options = [
  { id: "a", text: "Alpha" },
  { id: "b", text: "Bravo" },
  { id: "c", text: "Charlie" },
];

const renderQuestion = (props: Partial<React.ComponentProps<typeof QuizQuestion>> = {}) =>
  render(
    <QuizQuestion
      number={2}
      total={5}
      text="Pick one"
      options={options}
      value={null}
      onValueChange={() => undefined}
      {...props}
    />,
  );

describe("QuizQuestion", () => {
  test("names the radio group by the question and shows the position", () => {
    renderQuestion();
    expect(screen.getByRole("radiogroup", { name: "Pick one" })).toBeTruthy();
    expect(screen.getByText("Question 2 of 5")).toBeTruthy();
    expect(screen.getAllByRole("radio")).toHaveLength(3);
  });

  test("marks only the chosen option", () => {
    renderQuestion({ value: "b" });
    const radios = screen.getAllByRole("radio");
    expect(radios.map((radio) => radio.getAttribute("aria-checked"))).toEqual([
      "false",
      "true",
      "false",
    ]);
  });

  test("reports the option id when an option is clicked", () => {
    const onValueChange = vi.fn();
    renderQuestion({ onValueChange });
    fireEvent.click(screen.getAllByRole("radio")[2] as HTMLElement);
    expect(onValueChange).toHaveBeenCalledWith("c");
  });

  test("clicking the option text selects it", () => {
    const onValueChange = vi.fn();
    renderQuestion({ onValueChange });
    fireEvent.click(screen.getByText("Bravo"));
    expect(onValueChange).toHaveBeenCalledWith("b");
  });

  test("the options form one tab stop so arrow keys move between them", () => {
    renderQuestion({ value: "a" });
    const stops = screen
      .getAllByRole("radio")
      .filter((radio) => radio.getAttribute("tabindex") === "0");
    expect(stops).toHaveLength(1);
  });

  test("the heading can take focus for step changes", () => {
    renderQuestion();
    const heading = screen.getByRole("heading", { name: "Pick one" });
    heading.focus();
    expect(document.activeElement).toBe(heading);
  });
});
