module.exports = {
  apps: [{
    name: 'donorflow',
    script: './node_modules/.bin/next',
    args: 'start -p 7526',
    cwd: __dirname,
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production',
      PORT: 7526,
      HOSTNAME: '0.0.0.0'
    },
    error_file: './logs/error.log',
    out_file: './logs/out.log',
    log_file: './logs/combined.log',
    time: true
  }]
}
