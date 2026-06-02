// ecosystem.config.js — PM2 config cho staging & production
// Usage:
//   pm2 start ecosystem.config.js --env staging
//   pm2 start ecosystem.config.js --env production

module.exports = {
  apps: [
    {
      name: 'shopee-bot',        // production
      script: 'server.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
      env_production: {
        NODE_ENV: 'production',
        PORT: 3456,
      },
    },
    {
      name: 'shopee-staging',    // staging
      script: 'server.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
      env_staging: {
        NODE_ENV: 'staging',
        PORT: 3456,
      },
    },
    {
      name: 'shopee-frontend',   // Vite dev server (production + staging)
      script: 'node_modules/.bin/vite',
      args: '--host 0.0.0.0 --port 5173',
      cwd: './Affiliate-AI/client',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '256M',
    },
  ],
};
