import { Body, Container, Head, Html, Preview, Section, Text } from "@react-email/components";
import type { ReactNode } from "react";

interface EmailLayoutProps {
  preview: string;
  supportAddress: string;
  children: ReactNode;
}

const bodyStyle = { backgroundColor: "#ffffff", fontFamily: "Arial, Helvetica, sans-serif" };
const containerStyle = { maxWidth: "560px", margin: "0 auto", padding: "24px" };
const headingStyle = { fontSize: "20px", fontWeight: "bold", color: "#111827", margin: "0 0 16px" };
const footerStyle = { fontSize: "13px", color: "#4b5563", margin: "24px 0 0" };

export const EmailLayout = ({ preview, supportAddress, children }: EmailLayoutProps) => (
  <Html lang="en">
    <Head />
    <Preview>{preview}</Preview>
    <Body style={bodyStyle}>
      <Container style={containerStyle}>
        <Text style={headingStyle}>HEAT</Text>
        <Section>{children}</Section>
        <Text style={footerStyle}>
          Questions? Write to <a href={`mailto:${supportAddress}`}>{supportAddress}</a>.
        </Text>
      </Container>
    </Body>
  </Html>
);
