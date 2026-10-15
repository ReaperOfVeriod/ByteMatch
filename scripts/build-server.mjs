// Bundles the worker (dist/main.js) and the migrator (dist/migrate.js) for production.
// Dependencies stay external: they are installed next to dist/ (node_modules).
import { build } from "esbuild";

await build({
  entryPoints: { main: "src/worker/main.ts", migrate: "src/db/migrate.ts" },
  outdir: "dist",
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node24",
  packages: "external",
  sourcemap: true,
  alias: { "@": "./src" },
  // Some dependencies still call require(); give ESM bundles one.
  banner: { js: "import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);" },
  logLevel: "info",
});
