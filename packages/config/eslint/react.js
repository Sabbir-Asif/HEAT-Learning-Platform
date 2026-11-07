import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import tseslint from "typescript-eslint";
import base from "./base.js";

export default tseslint.config(...base, ...nextCoreWebVitals);
