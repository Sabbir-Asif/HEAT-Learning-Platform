const PLURAL_LIKE = new Set(["plural", "select", "selectordinal"]);

function isNameChar(code: number): boolean {
  return (
    (code >= 48 && code <= 57) ||
    (code >= 65 && code <= 90) ||
    code === 95 ||
    (code >= 97 && code <= 122)
  );
}

function skipSpaces(text: string, start: number): number {
  let index = start;
  while (index < text.length && /\s/.test(text.charAt(index))) index++;
  return index;
}

function readWord(text: string, start: number): [string, number] {
  let index = start;
  while (index < text.length && isNameChar(text.charCodeAt(index))) index++;
  return [text.slice(start, index), index];
}

function skipQuoted(text: string, index: number): number | null {
  const next = text.charAt(index + 1);
  if (next === "'") return index + 2;
  if (next !== "{" && next !== "}") return null;
  const end = text.indexOf("'", index + 2);
  return end === -1 ? text.length : end + 1;
}

function scan(text: string, start: number, names: Set<string>, nested: boolean): number {
  let index = start;
  while (index < text.length) {
    const char = text.charAt(index);
    if (char === "'") {
      index = skipQuoted(text, index) ?? index + 1;
    } else if (char === "}" && nested) {
      return index;
    } else if (char === "{") {
      index = argument(text, index + 1, names);
    } else {
      index++;
    }
  }
  return index;
}

function skipPlain(text: string, start: number): number {
  let depth = 1;
  let index = start;
  while (index < text.length && depth > 0) {
    const char = text.charAt(index);
    if (char === "{") depth++;
    if (char === "}") depth--;
    index++;
  }
  return index;
}

function options(text: string, start: number, names: Set<string>): number {
  let index = start;
  while (index < text.length) {
    index = skipSpaces(text, index);
    if (text.charAt(index) === "}") return index + 1;
    const selectorStart = index;
    while (index < text.length && !/[\s{}]/.test(text.charAt(index))) index++;
    index = skipSpaces(text, index);
    if (text.charAt(index) === "{") {
      index = scan(text, index + 1, names, true) + 1;
    } else if (index === selectorStart) {
      return index;
    }
  }
  return index;
}

function argument(text: string, start: number, names: Set<string>): number {
  const [name, afterName] = readWord(text, skipSpaces(text, start));
  const index = skipSpaces(text, afterName);
  if (name === "") return index;
  const separator = text.charAt(index);
  if (separator === "}") {
    names.add(name);
    return index + 1;
  }
  if (separator !== ",") return index;
  names.add(name);
  const [type, afterType] = readWord(text, skipSpaces(text, index + 1));
  const next = skipSpaces(text, afterType);
  if (PLURAL_LIKE.has(type) && text.charAt(next) === ",") return options(text, next + 1, names);
  return skipPlain(text, next);
}

export function placeholderNames(message: string): string[] {
  const names = new Set<string>();
  scan(message, 0, names, false);
  return [...names].sort();
}
