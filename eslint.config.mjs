// @ts-check
import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";
import { defineConfig } from "eslint/config";

export default defineConfig(
  {
    ignores: [
      "**/node_modules/**",
      "**/dist/**",
      "**/.next/**",
      "contracts/out/**",
      "contracts/cache/**",
      "contracts/lib/**",
      "**/coverage/**",
    ],
  },
  js.configs.recommended,
  tseslint.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: { ...globals.node },
    },
    rules: {
      // WORKING_RULES 6: không log PII. Backend sẽ thay console bằng logger có maskPii() (S0-06).
      "no-console": "warn",
    },
  },
);
