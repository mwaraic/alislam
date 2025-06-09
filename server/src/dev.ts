import 'dotenv/config'
import { serve } from '@hono/node-server'
import { serveStatic } from '@hono/node-server/serve-static'
import app from './index.js'

// Add static file serving for local development
app.use('/*', serveStatic({ 
  root: './client/dist',
  index: 'index.html'
}))

// Start server for Node.js runtime
const port = parseInt(process.env.PORT || '8787')
console.log(`🚀 Alislam Q&A Server running on http://localhost:${port}`)

serve({
  fetch: app.fetch,
  port: port
}) 