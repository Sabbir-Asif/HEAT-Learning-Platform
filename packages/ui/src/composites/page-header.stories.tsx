import type { Meta, StoryObj } from "@storybook/react-vite";
import { PlusIcon } from "lucide-react";
import { expect, within } from "storybook/test";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "../components/breadcrumb";
import { TooltipProvider } from "../components/tooltip";
import { PageHeader, PageHeaderAction } from "./page-header";

const meta = {
  title: "Composites/PageHeader",
  component: PageHeader,
  tags: ["test"],
  args: {
    title: "Courses and a very long title that has to wrap on a narrow screen",
    breadcrumbs: (
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="#">Home</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>Courses</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
    ),
    action: <PageHeaderAction icon={PlusIcon} label="New course" />,
  },
  render: (args) => (
    <TooltipProvider>
      <div className="p-4">
        <PageHeader {...args} />
      </div>
    </TooltipProvider>
  ),
} satisfies Meta<typeof PageHeader>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(canvas.getByRole("button", { name: "New course" })).toBeVisible();
  },
};

export const Light: Story = { ...Default, globals: { theme: "light" } };

export const Dark: Story = { ...Default, globals: { theme: "dark" } };

export const Phone: Story = {
  ...Default,
  parameters: { viewport: { defaultViewport: "mobile1" } },
};
