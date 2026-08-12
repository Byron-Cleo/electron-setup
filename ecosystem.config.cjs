module.exports = {
  apps: [
    {
      name: "eraeva-backend",
      cwd: "C:/Users/User/Desktop/pos/electron-setup/backend",
      script: "dist/index.js",
      interpreter: "node",
      exec_mode: "fork",
      instances: 1,
      autorestart: true,
      max_restarts: 10,
      min_uptime: "10s",
      restart_delay: 3000,
      kill_timeout: 5000,
      time: true,
      env: {
        NODE_ENV: "production",
      },
    },
  ],
}
