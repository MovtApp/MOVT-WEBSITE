import js from "@eslint/js";
import globals from "globals";

export default [
  { ignores: ["dist/", "node_modules/", ".vercel/", ".claude/"] },
  js.configs.recommended,
  {
    files: ["src/**/*.js"],
    languageOptions: { ecmaVersion: 2023, sourceType: "module", globals: globals.browser },
    rules: {
      "no-empty": ["error", { allowEmptyCatch: true }],
      "no-implied-eval": "error",
      "no-new-func": "error",
      "no-script-url": "error",
    },
  },
  {
    files: ["public/scripts/**/*.js"],
    languageOptions: { ecmaVersion: 2019, sourceType: "script", globals: globals.browser },
  },
  {
    files: ["*.config.js", "api/**/*.js", "scripts/**/*.mjs", "tests/**/*.js"],
    languageOptions: { ecmaVersion: 2024, sourceType: "module", globals: globals.node },
    rules: { "no-empty": ["error", { allowEmptyCatch: true }] },
  },
];
