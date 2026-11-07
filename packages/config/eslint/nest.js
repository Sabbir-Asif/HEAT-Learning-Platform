import globals from "globals";
import tseslint from "typescript-eslint";
import base from "./base.js";

/** NestJS API and worker. */
export default tseslint.config(...base, { languageOptions: { globals: globals.node } });
