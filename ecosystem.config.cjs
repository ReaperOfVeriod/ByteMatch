// pm2 process file: `yarn build`, then `yarn pm2:start` (or `pm2 start ecosystem.config.cjs`).
// Settings come from .env in this folder (copy .env.example). Run `yarn db:migrate` before starting
// a new version. `pm2 save` + `pm2 startup` keep both processes running across reboots.
const ENV_FILE = "--env-file-if-exists=.env";

module.exports = {
  apps: [
    {
      // The website, badges, API and GitHub webhook endpoint. Stateless and in cluster mode, so
      // raising `instances` (or "max") runs more processes that share port 5000.
      name: "bytematch-web",
      script: "node_modules/next/dist/bin/next",
      args: "start -H 0.0.0.0 -p 5000",
      node_args: ENV_FILE,
      cwd: __dirname,
      instances: 1,
      exec_mode: "cluster",
      env: { NODE_ENV: "production" },
      max_memory_restart: "1G",
    },
    {
      // Ingests CI artifacts, polls GitHub, writes PR comments, imports decomp.dev history.
      // Jobs are shared through Postgres (pg-boss), so several workers can run side by side.
      name: "bytematch-worker",
      script: "dist/main.js",
      node_args: ENV_FILE,
      cwd: __dirname,
      instances: 1,
      exec_mode: "fork",
      env: { NODE_ENV: "production" },
      max_memory_restart: "1G",
      kill_timeout: 30000,
    },
  ],
};
