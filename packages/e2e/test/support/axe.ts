import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";

export const wcagTags = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

export async function scan(page: Page) {
  const { violations } = await new AxeBuilder({ page }).withTags(wcagTags).analyze();
  return violations.flatMap((violation) =>
    violation.nodes.map(
      (node) => `${violation.id} [${violation.impact ?? "unknown"}] ${node.target.join(" ")}`,
    ),
  );
}
