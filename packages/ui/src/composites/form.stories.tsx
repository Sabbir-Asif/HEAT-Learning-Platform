import type { Meta, StoryObj } from "@storybook/react-vite";
import { useForm } from "react-hook-form";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { Button } from "../components/button";
import { Input } from "../components/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/select";
import { Textarea } from "../components/textarea";
import { applyServerError } from "./apply-server-error";
import { Form, FormField, FormMessage } from "./form";

type Values = { email: string; role: string; note: string };

const roles = [
  { value: "learner", label: "Learner" },
  { value: "moderator", label: "Moderator" },
];

type DemoProps = { response: unknown };

function Demo({ response }: DemoProps) {
  const form = useForm<Values>({ defaultValues: { email: "", role: "", note: "" } });

  return (
    <div className="max-w-sm p-4">
      <Form form={form} onSubmit={() => applyServerError(form, response)}>
        <FormField
          name="email"
          label="Email"
          description="Use the address you registered with."
          render={({ field, controlProps }) => <Input type="email" {...field} {...controlProps} />}
        />
        <FormField
          name="role"
          label="Role"
          render={({ field, controlProps }) => (
            <Select items={roles} value={field.value} onValueChange={field.onChange}>
              <SelectTrigger
                ref={field.ref}
                id={controlProps.id}
                aria-invalid={controlProps["aria-invalid"]}
                aria-describedby={controlProps["aria-describedby"]}
                className="w-full"
              >
                <SelectValue placeholder="Choose a role" />
              </SelectTrigger>
              <SelectContent>
                {roles.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
        <FormField
          name="note"
          label="Note"
          render={({ field, controlProps }) => <Textarea {...field} {...controlProps} />}
        />
        <FormMessage />
        <Button type="submit">Save</Button>
      </Form>
    </div>
  );
}

const fieldErrors = {
  error: {
    code: "VALIDATION_FAILED",
    message: "Validation failed",
    requestId: "req-1",
    fields: [
      { path: "note", code: "too_big" },
      { path: "email", code: "invalid_format" },
      { path: "role", code: "required" },
    ],
  },
};

const unmatched = {
  error: {
    code: "VALIDATION_FAILED",
    message: "Validation failed",
    requestId: "req-2",
    fields: [{ path: "ghost", code: "custom" }],
  },
};

const rateLimited = {
  error: { code: "RATE_LIMITED", message: "Slow down", requestId: "req-3" },
};

const meta = {
  title: "Composites/Form",
  component: Demo,
  tags: ["test"],
  args: { response: fieldErrors },
} satisfies Meta<typeof Demo>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: { response: rateLimited },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const email = canvas.getByLabelText("Email");
    await expect(email).toHaveAttribute("aria-invalid", "false");
    await expect(email).toHaveAccessibleDescription("Use the address you registered with.");
  },
};

export const Light: Story = { ...Default, globals: { theme: "light" } };

export const Dark: Story = { ...Default, globals: { theme: "dark" } };

export const ServerError: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "Save" }));

    const email = canvas.getByLabelText("Email");
    await waitFor(() => expect(email).toHaveAttribute("aria-invalid", "true"));
    await expect(email).toHaveFocus();
    await expect(email).toHaveAccessibleDescription(
      "Use the address you registered with. This is not in the expected format.",
    );
    await expect(canvas.getByRole("combobox", { name: "Role" })).toHaveAttribute(
      "aria-invalid",
      "true",
    );
    await expect(canvas.getByLabelText("Note")).toHaveAttribute("aria-invalid", "true");
    await expect(
      canvas.queryByText("Something in the form needs another look.", { exact: false }),
    ).toBeNull();

    await userEvent.type(email, "a");
    await waitFor(() => expect(email).toHaveAttribute("aria-invalid", "false"));
    await expect(canvas.getByLabelText("Note")).toHaveAttribute("aria-invalid", "true");
  },
};

export const ServerErrorDark: Story = { ...ServerError, globals: { theme: "dark" } };

export const UnmatchedPath: Story = {
  args: { response: unmatched },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "Save" }));

    const message = await canvas.findByRole("alert");
    await expect(message).toHaveTextContent("Something in the form needs another look");
    await expect(message).not.toHaveTextContent("ghost");
    await expect(canvas.getByLabelText("Email")).toHaveAttribute("aria-invalid", "false");
  },
};

export const RateLimited: Story = {
  args: { response: rateLimited },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "Save" }));

    await expect(await canvas.findByRole("alert")).toHaveTextContent("Too many attempts");
    await expect(canvas.getByLabelText("Email")).toHaveAttribute("aria-invalid", "false");
  },
};
