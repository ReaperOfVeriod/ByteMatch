// pm2 process file: `yarn build`, then `yarn pm2:start` (or `pm2 start ecosystem.config.cjs`).
// Settings come from .env in this folder (copy .env.example). Run `yarn db:migrate` before starting
// a new version. `pm2 save` + `pm2 startup` keep both processes running across reboots.
const { existsSync, readFileSync } = require("node:fs");
const { join } = require("node:path");
const { parseEnv } = require("node:util");

// .env is read here and handed to pm2 as each app's env. pm2 starts apps from its daemon, whose
// own environment they inherit; values set that way (another app's DATABASE_URL, say) would beat
// a .env loaded inside the process, because neither Node nor Next.js overrides a set variable.
const ENV_PATH = join(__dirname, ".env");
const fromFile = existsSync(ENV_PATH) ? parseEnv(readFileSync(ENV_PATH, "utf8")) : {};
const env = { ...fromFile, NODE_ENV: "production" };

module.exports = {
  apps: [
    {
      // The website, badges, API and GitHub webhook endpoint. Stateless and in cluster mode, so
      // raising `instances` (or "max") runs more processes that share port 5000.
      name: "bytematch-web",
      script: "node_modules/next/dist/bin/next",
      args: "start -H 0.0.0.0 -p 5000",
      cwd: __dirname,
      instances: 1,
      exec_mode: "cluster",
      env,
      max_memory_restart: "1G",
    },
    {
      // Ingests CI artifacts, polls GitHub, writes PR comments, imports decomp.dev history.
      // Jobs are shared through Postgres (pg-boss), so several workers can run side by side.
      name: "bytematch-worker",
      script: "dist/main.js",
      cwd: __dirname,
      instances: 1,
      exec_mode: "fork",
      env,
      max_memory_restart: "1G",
      kill_timeout: 30000,
    },
  ],
};
