import type { Meta, StoryObj } from "@storybook/react-vite";
import { QuizReviewQuestion } from "./quiz-review-question";

const options = [
  { id: "a", text: "Report it to the safety office" },
  { id: "b", text: "Ignore it" },
  { id: "c", text: "Wait a week" },
];

const meta = {
  title: "Composites/QuizReviewQuestion",
  component: QuizReviewQuestion,
  args: {
    number: 2,
    text: "What should you do first?",
    options,
    selectedOptionId: "a",
    correctOptionId: "a",
    explanation: "The safety office can act on a report quickly.",
  },
} satisfies Meta<typeof QuizReviewQuestion>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Correct: Story = {};

export const Wrong: Story = { args: { selectedOptionId: "b" } };

export const WithoutExplanation: Story = { args: { explanation: null } };
