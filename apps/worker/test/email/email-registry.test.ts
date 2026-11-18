import { describe, expect, test } from "vitest";
import {
  EmailTemplateError,
  emailCategories,
  emailTemplateKeys,
  listEmailTemplates,
  renderEmail,
  type EmailContext,
} from "../../src/email";

const context: EmailContext = {
  publicAppUrl: "https://learn.heat.example",
  adminAppUrl: "https://admin.heat.example",
  supportAddress: "support@heat.example",
};

const validVariables: Record<string, Record<string, unknown>> = {
  "student-verification": { name: "Amina", token: "tok123" },
  "student-already-registered": { name: "Amina" },
  "password-change-code": { name: "Amina", code: "482910", expiresInMinutes: 15 },
  "password-reset": { name: "Amina", token: "tok123" },
  "enrollment-approved": { name: "Amina", courseTitle: "HEAT Basics" },
  "enrollment-rejected": { name: "Amina", courseTitle: "HEAT Basics", reason: "Incomplete form" },
  "enrollment-removed": { name: "Amina", courseTitle: "HEAT Basics", reason: "Duplicate account" },
  "enrollment-reinstated": { name: "Amina", courseTitle: "HEAT Basics" },
  "certificate-ready": { name: "Amina", courseTitle: "HEAT Basics", certificateCode: "CERT-001" },
  "admin-invitation": { name: "Rahim", token: "inv456", expiresAt: "2026-11-14T06:00:00.000Z" },
};

const optionalFields: Record<string, string[]> = { "enrollment-rejected": ["reason"] };

const stringFieldsOf = (key: string): string[] =>
  Object.entries(validVariables[key] ?? {})
    .filter(([field, value]) => typeof value === "string" && !optionalFields[key]?.includes(field))
    .map(([field]) => field);

describe("registry", () => {
  test("lists every template with a known category", async () => {
    const listed = listEmailTemplates();
    expect(listed.map((template) => template.key).sort()).toEqual([...emailTemplateKeys].sort());
    expect(Object.keys(validVariables).sort()).toEqual([...emailTemplateKeys].sort());
    for (const template of listed) expect(emailCategories).toContain(template.category);
  });

  test("keeps the keys other tickets already write to the outbox", async () => {
    expect(emailTemplateKeys).toContain("student-already-registered");
    expect(emailTemplateKeys).toContain("admin-invitation");
  });

  test("maps categories to the quota budgets", async () => {
    const category = (key: string) => listEmailTemplates().find((t) => t.key === key)?.category;
    expect(category("student-verification")).toBe("VERIFICATION");
    expect(category("password-reset")).toBe("PASSWORD");
    expect(category("password-change-code")).toBe("PASSWORD");
    expect(category("enrollment-rejected")).toBe("ENROLLMENT");
    expect(category("certificate-ready")).toBe("CERTIFICATE");
  });

  test("rejects an unknown template key", async () => {
    await expect(renderEmail("nope", {}, context)).rejects.toThrow(EmailTemplateError);
  });
});

describe.each(emailTemplateKeys)("%s", (key) => {
  const variables = validVariables[key] ?? {};

  test("renders a subject, an HTML part and a text part", async () => {
    const message = await renderEmail(key, variables, context);
    expect(message.subject.length).toBeGreaterThan(0);
    expect(message.subject).not.toMatch(/[\r\n]/);
    expect(message.html).toContain("<html");
    expect(message.text.length).toBeGreaterThan(0);
    expect(message.html).toContain("WSAP");
    expect(message.text).toContain("WSAP");
    expect(message.text).toContain(context.supportAddress);
    expect(message.html).not.toMatch(/<img/i);
  });

  test("matches the snapshot", async () => {
    const message = await renderEmail(key, variables, context);
    expect({ subject: message.subject, text: message.text }).toMatchSnapshot();
  });

  test("text part carries every link of the HTML part", async () => {
    const message = await renderEmail(key, variables, context);
    const hrefs = [...message.html.matchAll(/href="([^"]+)"/g)]
      .map((match) => (match[1] ?? "").replaceAll("&amp;", "&"))
      .filter((href) => !href.startsWith("mailto:"));
    for (const href of hrefs) expect(message.text).toContain(href);
  });

  test("renders deterministically", async () => {
    expect(await renderEmail(key, variables, context)).toEqual(
      await renderEmail(key, variables, context),
    );
  });

  test("fails with the missing variable names and no values", async () => {
    const fields = Object.keys(variables);
    for (const field of fields.filter((name) => !optionalFields[key]?.includes(name))) {
      const incomplete = { ...variables };
      delete incomplete[field];
      let caught: unknown;
      try {
        await renderEmail(key, incomplete, context);
      } catch (error) {
        caught = error;
      }
      expect(caught).toBeInstanceOf(EmailTemplateError);
      const message = (caught as Error).message;
      expect(message).toContain(field);
      for (const value of Object.values(variables)) expect(message).not.toContain(String(value));
    }
  });

  test("fails on blank string variables", async () => {
    for (const field of stringFieldsOf(key)) {
      await expect(renderEmail(key, { ...variables, [field]: "   " }, context)).rejects.toThrow(
        EmailTemplateError,
      );
    }
  });

  test("escapes HTML in every string variable", async () => {
    const payload = `<script>alert("x")</script><b>&`;
    for (const field of stringFieldsOf(key)) {
      if (field === "token" || field === "certificateCode" || field === "code") continue;
      if (field === "expiresAt") continue;
      const message = await renderEmail(key, { ...variables, [field]: payload }, context);
      expect(message.html).not.toContain("<script>");
      expect(message.html).not.toContain("<b>&");
      expect(message.html).toContain("&lt;script&gt;");
      expect(message.subject).not.toMatch(/[\r\n]/);
    }
  });
});

describe("links", () => {
  test("verification link uses the configured public base URL and encodes the token", async () => {
    const message = await renderEmail(
      "student-verification",
      { name: "Amina", token: "a/b?c=d&e" },
      context,
    );
    expect(message.text).toContain("https://learn.heat.example/verify-email/a%2Fb%3Fc%3Dd%26e");
    expect(message.html).not.toContain("a/b?c=d");
  });

  test("admin invitation uses the admin base URL", async () => {
    const message = await renderEmail(
      "admin-invitation",
      validVariables["admin-invitation"] ?? {},
      context,
    );
    expect(message.text).toContain("https://admin.heat.example/accept-invite/inv456");
    expect(message.text).not.toContain("learn.heat.example");
  });

  test("a variable cannot supply its own link", async () => {
    const message = await renderEmail(
      "student-verification",
      { name: "https://evil.example/phish", token: "tok123" },
      context,
    );
    const hrefs = [...message.html.matchAll(/href="([^"]+)"/g)].map((match) => match[1] ?? "");
    for (const href of hrefs) {
      expect(href.startsWith("https://learn.heat.example") || href.startsWith("mailto:")).toBe(
        true,
      );
    }
  });

  test("rejects a base URL that is not an origin", async () => {
    const variables = validVariables["student-verification"] ?? {};
    await expect(
      renderEmail("student-verification", variables, {
        ...context,
        publicAppUrl: "https://learn.heat.example/path",
      }),
    ).rejects.toThrow(EmailTemplateError);
    await expect(
      renderEmail("student-verification", variables, {
        ...context,
        publicAppUrl: "javascript:alert(1)",
      }),
    ).rejects.toThrow(EmailTemplateError);
  });
});

describe("content", () => {
  test("rejection mail states the reason in both parts", async () => {
    const message = await renderEmail(
      "enrollment-rejected",
      { name: "Amina", courseTitle: "HEAT Basics", reason: `Needs <i>proof</i> & "ID"` },
      context,
    );
    expect(message.html).toContain("&lt;i&gt;proof&lt;/i&gt;");
    expect(message.html).not.toContain("<i>proof</i>");
    expect(message.text).toContain("Needs <i>proof</i>");
    expect(message.text).toContain("HEAT Basics");
  });

  test("removal mail escapes the reason in html and keeps it verbatim in text", async () => {
    const message = await renderEmail(
      "enrollment-removed",
      { name: "Amina", courseTitle: "HEAT Basics", reason: `<script>alert(1)</script> & "x"` },
      context,
    );
    expect(message.html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
    expect(message.html).not.toContain("<script>alert(1)");
    expect(message.text).toContain("<script>alert(1)</script>");
  });

  test("rejection mail renders without a reason", async () => {
    const message = await renderEmail(
      "enrollment-rejected",
      { name: "Amina", courseTitle: "HEAT Basics" },
      context,
    );
    expect(message.text).not.toContain("Reason:");
  });

  test("subject drops line breaks from variables", async () => {
    const message = await renderEmail(
      "enrollment-approved",
      { name: "Amina", courseTitle: "HEAT\r\nBcc: x@evil.example" },
      context,
    );
    expect(message.subject).not.toMatch(/[\r\n]/);
  });

  test("password change code shows the code and its lifetime", async () => {
    const message = await renderEmail(
      "password-change-code",
      validVariables["password-change-code"] ?? {},
      context,
    );
    expect(message.text).toContain("482910");
    expect(message.text).toContain("15 minutes");
  });

  test("admin invitation shows the expiry in Asia/Dhaka time", async () => {
    const message = await renderEmail(
      "admin-invitation",
      validVariables["admin-invitation"] ?? {},
      context,
    );
    expect(message.text).toContain("12:00");
    expect(message.text).toContain("Asia/Dhaka");
  });

  test("password change code variables must be sensible", async () => {
    await expect(
      renderEmail("password-change-code", { name: "A", code: "1", expiresInMinutes: 0 }, context),
    ).rejects.toThrow(EmailTemplateError);
  });
});
