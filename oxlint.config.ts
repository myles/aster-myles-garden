import mylesOxlintConfig from "@mylesb/oxlint-config";
import { defineConfig } from "oxlint";

export default defineConfig({
  extends: [mylesOxlintConfig],
  rules: {
    "no-console": "off",
    // Underscores mark private members in this project.
    "no-underscore-dangle": "off",
    // Keep style diagnostics as warnings; lint fails on either severity.
    "import/no-unassigned-import": "warn",
    "promise/always-return": "warn",
    "unicorn/consistent-function-scoping": "warn",
    "unicorn/no-array-sort": "warn",
    "unicorn/no-new-array": "warn",
    "unicorn/prefer-add-event-listener": "warn",
    "no-new": "warn",
    "no-useless-concat": "warn",
  },
});
