module.exports = {
  apps: [
    {
      name: 'samsecure-dev',
      cwd: '/var/www/samsecure/app',
      script: 'npm',
      args: 'run dev',
      interpreter: 'none',
      env: {
        NODE_ENV: 'development'
      }
    }
  ]
}