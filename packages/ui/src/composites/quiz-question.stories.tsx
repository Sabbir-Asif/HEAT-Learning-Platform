import type { Meta, StoryObj } from "@storybook/react-vite";
import { QuizQuestion } from "./quiz-question";

const options = [
  { id: "a", text: "Report it to the safety office" },
  { id: "b", text: "Ignore it" },
  { id: "c", text: "Wait a week" },
];

const meta = {
  title: "Composites/QuizQuestion",
  component: QuizQuestion,
  args: {
    number: 2,
    total: 5,
    text: "What should you do first?",
    options,
    value: null,
    onValueChange: () => undefined,
  },
} satisfies Meta<typeof QuizQuestion>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Unanswered: Story = {};

export const Answered: Story = { args: { value: "a" } };
