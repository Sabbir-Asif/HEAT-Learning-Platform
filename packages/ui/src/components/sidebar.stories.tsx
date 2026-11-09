import type { Meta, StoryObj } from "@storybook/react-vite";
import { BookOpenIcon, GraduationCapIcon, UsersIcon } from "lucide-react";
import { expect } from "storybook/test";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from "./sidebar";

const meta = {
  title: "Primitives/Sidebar",
  component: SidebarProvider,
  tags: ["test"],
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof SidebarProvider>;

export default meta;
type Story = StoryObj<typeof meta>;

const content = () => (
  <SidebarProvider>
    <Sidebar>
      <SidebarHeader>
        <span className="font-display text-heading-3 px-2">HEAT</span>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Manage</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton isActive>
                  <BookOpenIcon />
                  <span>Courses</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton>
                  <UsersIcon />
                  <span>Students</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton>
                  <GraduationCapIcon />
                  <span>Certificates</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
    <SidebarInset>
      <header className="flex items-center gap-2 p-4">
        <SidebarTrigger />
        <h1 className="text-heading-3">Courses</h1>
      </header>
    </SidebarInset>
  </SidebarProvider>
);

export const Default: Story = { render: content };

export const Light: Story = { render: content, globals: { theme: "light" } };

export const Dark: Story = { render: content, globals: { theme: "dark" } };

export const Navigation: Story = {
  render: content,
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("button", { name: "Courses" })).toBeVisible();
    await expect(canvas.getByRole("button", { name: "Students" })).toBeVisible();
  },
};
