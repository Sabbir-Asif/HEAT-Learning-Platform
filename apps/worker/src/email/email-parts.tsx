import { Text } from "@react-email/components";
import type { ReactNode } from "react";

const textStyle = { fontSize: "15px", lineHeight: "22px", color: "#111827", margin: "0 0 12px" };
const codeStyle = { ...textStyle, fontSize: "24px", fontWeight: "bold", letterSpacing: "4px" };

export const Paragraph = ({ children }: { children: ReactNode }) => (
  <Text style={textStyle}>{children}</Text>
);

export const CodeLine = ({ children }: { children: ReactNode }) => (
  <Text style={codeStyle}>{children}</Text>
);

export const ActionLink = ({ href, label }: { href: string; label: string }) => (
  <Text style={textStyle}>
    {label}: <a href={href}>{href}</a>
  </Text>
);
