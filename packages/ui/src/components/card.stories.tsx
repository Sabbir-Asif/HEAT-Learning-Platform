import type { Meta, StoryObj } from "@storybook/react-vite";
import { Button } from "./button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "./card";

const meta = {
  title: "Primitives/Card",
  component: Card,
  tags: ["test"],
} satisfies Meta<typeof Card>;

export default meta;
type Story = StoryObj<typeof meta>;

const content = () => (
  <div className="max-w-sm p-4">
    <Card>
      <CardHeader>
        <CardTitle>Module 1</CardTitle>
        <CardDescription>Recognising harassment</CardDescription>
      </CardHeader>
      <CardContent>Three lessons and a short quiz.</CardContent>
      <CardFooter>
        <Button>Continue</Button>
      </CardFooter>
    </Card>
  </div>
);

export const Default: Story = { render: content };

export const Light: Story = { render: content, globals: { theme: "light" } };

export const Dark: Story = { render: content, globals: { theme: "dark" } };
