import { relative, sep } from "node:path";

export const APP_CSS_ENTRY = "src/app/globals.css";

const allowedEntryStatements = [
  /^@import\s+(["'])@heat\/ui\/styles\.css\1\s*;?$/,
  /^@source\s+(["'])[^"']+\1\s*;?$/,
];

export const cssEntryOnly = {
  meta: {
    type: "problem",
    schema: [],
    messages: {
      extraFile:
        "CSS file '{{file}}' is not allowed in an app. Styles are written only in @heat/ui; the app keeps just {{entry}}.",
      entryStatement:
        "{{entry}} may only hold the @heat/ui styles import and @source lines. Move this to @heat/ui.",
    },
  },
  create(context) {
    const file = relative(context.cwd, context.filename).split(sep).join("/");
    return {
      StyleSheet(node) {
        if (file !== APP_CSS_ENTRY) {
          context.report({ node, messageId: "extraFile", data: { file, entry: APP_CSS_ENTRY } });
          return;
        }
        for (const child of node.children) {
          const text = context.sourceCode.getText(child).trim();
          if (!allowedEntryStatements.some((pattern) => pattern.test(text))) {
            context.report({
              node: child,
              messageId: "entryStatement",
              data: { entry: APP_CSS_ENTRY },
            });
          }
        }
      },
    };
  },
};
