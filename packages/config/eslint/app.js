import tseslint from "typescript-eslint";
import react from "./react.js";
import { appCssConfig, appStylingConfig, classOrderConfig, scopeToScripts } from "./styling.js";

export default tseslint.config(
  ...scopeToScripts(react),
  classOrderConfig,
  appStylingConfig,
  appCssConfig,
);
