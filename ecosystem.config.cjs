const ROOT = '/var/www/samsecure'

module.exports = {
  apps: [
    {
      // API staging : lit server/.env.staging
      name: 'samsecure-api-staging',
      cwd: ROOT,
      script: 'server/index.js',
      env: {
        NODE_ENV: 'production',
        APP_ENV: 'staging'
      }
    },
    {
      // Dev : concurrently -> API dev (3002) + Vite (5173), lit server/.env.dev
      name: 'samsecure-dev',
      cwd: ROOT,
      script: 'npm',
      args: 'run dev',
      interpreter: 'none',
      env: {
        NODE_ENV: 'development',
        APP_ENV: 'dev'
      }
    }
  ]
}
