import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, within } from "storybook/test";
import { CertificateCard } from "./certificate-card";

const meta = {
  title: "Composites/CertificateCard",
  component: CertificateCard,
  tags: ["test"],
  args: {
    courseTitle: "HEAT Gender Safety Training",
    status: "ready",
    number: "ABCD-EFGH-JKMN",
    issuedLabel: "12 November 2026",
    verificationUrl: "https://learn.example/verify/ABCD-EFGH-JKMN",
    downloadHref: "/api/certificates/0198f1a0-0000-7000-8000-0000000000a1/download",
    onCopyLink: () => undefined,
  },
} satisfies Meta<typeof CertificateCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Ready: Story = {
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText(/Download PDF/)).toBeInTheDocument();
  },
};

export const ReadyLight: Story = { ...Ready, globals: { theme: "light" } };

export const ReadyDark: Story = { ...Ready, globals: { theme: "dark" } };

export const Pending: Story = {
  args: {
    status: "pending",
    number: undefined,
    issuedLabel: undefined,
    verificationUrl: undefined,
    downloadHref: undefined,
  },
};

export const Revoked: Story = { args: { status: "revoked", downloadHref: undefined } };
