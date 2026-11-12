const replacements: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
  "`": "&#96;",
};

export const escapeHtml = (value: string): string =>
  value.replace(/[&<>"'`]/g, (character) => replacements[character] ?? character);
