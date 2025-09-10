module.exports = {
  apps: [
    {
      name: "crm-api",
      cwd: "/srv/crm/backend",
      script: "npm",
      args: "run start",
      instances: 2,
      exec_mode: "cluster",
      env_production: {
        NODE_ENV: "production",
        PORT: "3001"
      },
      error_file: "/var/log/crm/api-error.log",
      out_file: "/var/log/crm/api-out.log",
      merge_logs: true,
      time: true,
      max_memory_restart: "1G",
      autorestart: true,
      max_restarts: 10,
      min_uptime: "10s"
    },
    {
      name: "crm-worker",
      cwd: "/srv/crm/backend",
      script: "npm",
      args: "run worker",
      instances: 1,
      exec_mode: "fork",
      env_production: {
        NODE_ENV: "production"
      },
      error_file: "/var/log/crm/worker-error.log",
      out_file: "/var/log/crm/worker-out.log",
      merge_logs: true,
      time: true,
      max_memory_restart: "500M",
      autorestart: true,
      max_restarts: 10,
      min_uptime: "10s"
    }
  ]
};