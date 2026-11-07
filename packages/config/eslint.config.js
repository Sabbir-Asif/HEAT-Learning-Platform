import globals from "globals";
import base from "./eslint/base.js";

export default [
  ...base,
  { files: ["bin/**", "src/**", "test/**"], languageOptions: { globals: globals.node } },
];
