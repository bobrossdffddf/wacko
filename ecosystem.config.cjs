module.exports = {
  apps: [{
    name: 'wacko',
    script: './start.mjs',
    cwd: __dirname,
    instances: 1,
    exec_mode: 'fork',
    autorestart: true,
    watch: false,
    max_memory_restart: '150M',
    restart_delay: 2000,
    max_restarts: 10,
    min_uptime: '10s',
    kill_timeout: 6000,
    time: true,
    env: { NODE_ENV: 'production', HOST: '192.168.68.58', PORT: 3000, ALLOWED_SUBNET: '192.168.68.0/24' }
  }]
};
