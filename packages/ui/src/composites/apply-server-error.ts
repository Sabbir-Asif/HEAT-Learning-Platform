import { toFormErrors } from "./form-errors";

type ServerErrorForm = {
  setError(name: string, error: { type: string; message: string }): void;
  getValues(): unknown;
};

type ApplyServerErrorOptions = {
  knownPaths?: readonly string[];
  root?: ParentNode;
};

const focusable = "input, textarea, select, button, [tabindex]:not([tabindex='-1'])";

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function leafPaths(value: unknown, prefix = ""): string[] {
  const entries = Array.isArray(value)
    ? value.map((item, index) => [String(index), item] as const)
    : isPlainObject(value)
      ? Object.entries(value)
      : [];
  if (entries.length === 0) return prefix ? [prefix] : [];
  return entries.flatMap(([key, item]) => leafPaths(item, prefix ? `${prefix}.${key}` : key));
}

function focusFirstInvalid(paths: ReadonlySet<string>, root: ParentNode) {
  const wrappers = root.querySelectorAll<HTMLElement>('[data-slot="form-field"][data-field-name]');
  for (const wrapper of wrappers) {
    if (!paths.has(wrapper.dataset.fieldName ?? "")) continue;
    wrapper.querySelector<HTMLElement>(focusable)?.focus();
    return;
  }
}

export function applyServerError(
  form: ServerErrorForm,
  payload: unknown,
  options: ApplyServerErrorOptions = {},
) {
  const knownPaths = options.knownPaths ?? leafPaths(form.getValues());
  const { fields, formMessage } = toFormErrors(payload, knownPaths);

  for (const field of fields) {
    form.setError(field.path, { type: "server", message: field.message });
  }
  if (formMessage) {
    form.setError("root.server", { type: "server", message: formMessage });
  }
  if (fields.length > 0) {
    focusFirstInvalid(new Set(fields.map((field) => field.path)), options.root ?? document);
  }
}

export type { ApplyServerErrorOptions, ServerErrorForm };
