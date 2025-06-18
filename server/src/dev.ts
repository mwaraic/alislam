import 'dotenv/config'
import { serve } from '@hono/node-server'
import { serveStatic } from '@hono/node-server/serve-static'
import { cors } from 'hono/cors'
import app from './index.js'

// Configure CORS for development
app.use('*', cors({
  origin: ['http://localhost:5173'],
  credentials: true,
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
  exposeHeaders: ['Content-Type', 'Cache-Control']
}))

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