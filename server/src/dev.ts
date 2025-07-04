import { serve } from '@hono/node-server'
import app from './index'

const port = Number(process.env.PORT) || 8787

console.log(`Starting server on port ${port}`)

serve({
  fetch: app.fetch,
  port: port,
  hostname: '0.0.0.0'  // Important: bind to all interfaces for container
})

console.log(`🚀 Server running at http://0.0.0.0:${port}/`) 