import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import prettier from "eslint-config-prettier/flat";

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrorsIgnorePattern: "^_", destructuredArrayIgnorePattern: "^_" },
      ],
      "@typescript-eslint/consistent-type-imports": ["error", { prefer: "type-imports", fixStyle: "separate-type-imports" }],
      eqeqeq: ["error", "smart"],
      "no-console": ["warn", { allow: ["error", "warn"] }],
    },
  },
  {
    // The worker and the migration script are long-running CLI processes that log to stdout.
    files: ["src/worker/**", "src/db/migrate.ts", "scripts/**"],
    rules: {
      "no-console": "off",
    },
  },
  {
    // CommonJS config files (pm2's ecosystem file) load modules with require().
    files: ["**/*.cjs"],
    rules: {
      "@typescript-eslint/no-require-imports": "off",
    },
  },
  // Must stay last: turns off stylistic rules that would conflict with Prettier.
  prettier,
  globalIgnores([".next/**", "out/**", "build/**", "dist/**", "drizzle/**", "node_modules/**", "coverage/**", "next-env.d.ts"]),
]);
