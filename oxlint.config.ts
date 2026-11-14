import mylesOxlintConfig from "@mylesb/oxlint-config";
import { defineConfig } from "oxlint";

export default defineConfig({
  extends: [mylesOxlintConfig],
  rules: {
    "no-console": "off",
    // Underscores mark private members in this project.
    "no-underscore-dangle": "off",
  },
});
