import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import tseslint from "typescript-eslint";
import base from "./base.js";

/** Next.js apps and React packages: base rules plus React, hooks, a11y and Next.js rules. */
export default tseslint.config(...base, ...nextCoreWebVitals);
