import tseslint from "typescript-eslint";
import react from "./react.js";
import { classOrderConfig } from "./styling.js";

export default tseslint.config(...react, classOrderConfig);
