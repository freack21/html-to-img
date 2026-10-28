// PM2 process file: `pm2 start ecosystem.config.cjs`
// Runs a single instance on purpose: SQLite and the in-memory rate limiter are per process.
module.exports = {
  apps: [
    {
      name: "html-to-img",
      cwd: `${__dirname}/server`,
      script: "src/index.js",
      node_args: "--env-file-if-exists=../.env --disable-warning=ExperimentalWarning",
      exec_mode: "fork",
      instances: 1,
      max_memory_restart: "768M",
      kill_timeout: 10000,
      env: { NODE_ENV: "production" },
    },
  ],
};
