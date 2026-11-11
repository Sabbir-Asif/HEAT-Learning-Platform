import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";
import { VideoUpload } from "./video-upload";

const gibibyte = 1024 ** 3;

const meta = {
  title: "Upload/VideoUpload",
  component: VideoUpload,
  args: {
    label: "Welcome video",
    state: { status: "idle" },
    maxBytes: 2 * gibibyte,
    onSelect: fn(),
    onPause: fn(),
    onResume: fn(),
    onCancel: fn(),
    onRetry: fn(),
  },
  decorators: [
    (Story) => (
      <div className="max-w-xl p-4">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof VideoUpload>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Idle: Story = {};

export const Replace: Story = { args: { hasVideo: true } };

export const Uploading: Story = {
  args: { state: { status: "uploading", fileName: "welcome.mp4", progress: 42 } },
};

export const Paused: Story = {
  args: { state: { status: "paused", fileName: "welcome.mp4", progress: 42 } },
};

export const Failed: Story = {
  args: {
    state: {
      status: "failed",
      fileName: "welcome.mp4",
      message: "The connection dropped. Retry to continue from where it stopped.",
    },
  },
};

export const Done: Story = { args: { state: { status: "done", fileName: "welcome.mp4" } } };

export const Locked: Story = { args: { disabled: true } };

export const Dark: Story = { globals: { theme: "dark" } };
