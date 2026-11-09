import base from "@heat/config/eslint/base";
import globals from "globals";

export default [...base, { languageOptions: { globals: globals.node } }];
