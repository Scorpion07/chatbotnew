module.exports = {
  apps: [
    {
      name: 'chatverse-backend',
      script: 'src/server.js',
      cwd: __dirname,
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      env: {
        NODE_ENV: 'production',
        PORT: 5000
      },
      error_file: '/var/log/chatverse/backend-error.log',
      out_file: '/var/log/chatverse/backend-out.log',
      time: true
    }
  ]
};
