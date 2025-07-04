import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { chatRoute } from './routes/chat'
import { agentRoute } from './routes/agent'

type Bindings = {
  GEMINI_API_KEY: string
  PINECONE_API_KEY: string
  COHERE_API_KEY: string
  PINECONE_API_KEY_2: string
  ASSETS?: any
}

type Variables = {
  env?: Bindings
}

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>()

// Configure CORS for development and production
app.use('*', cors({
  origin: '*',  // Allow all origins in development
  credentials: true,
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization']
}))

// Middleware to inject environment variables
app.use('*', async (c, next) => {
  // Set environment variables on context
  // In local development, merge process.env with c.env; in Cloudflare Workers, use c.env
  const env = {
    ...c.env,
    COHERE_API_KEY: c.env.COHERE_API_KEY,
    GEMINI_API_KEY: c.env.GEMINI_API_KEY,
    PINECONE_API_KEY: c.env.PINECONE_API_KEY,
    PINECONE_API_KEY_2: c.env.PINECONE_API_KEY_2,
  } as Bindings

  c.set('env', env)
  
  await next()
})

// API routes
app.route('/api/chat', chatRoute)
app.route('/api/agent', agentRoute)

// Health check endpoint
app.get('/api/health', (c) => {
  return c.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    service: 'Alislam Q&A API'
  })
})

// Handle static files (for production deployment)
app.get('*', async (c) => {
  try {
    // Try to serve static assets first (only in Workers environment)
    if (c.env.ASSETS) {
      const assetResponse = await c.env.ASSETS.fetch(c.req.raw)
      if (assetResponse.status !== 404) {
        return assetResponse
      }
      
      // If asset not found, serve index.html for SPA routing
      const indexResponse = await c.env.ASSETS.fetch(new Request(new URL('/index.html', c.req.url)))
      return new Response(indexResponse.body, {
        headers: {
          ...Object.fromEntries(indexResponse.headers),
          'Content-Type': 'text/html'
        }
      })
    }
    
    // For container deployment, serve files from filesystem
    const fs = await import('fs')
    const path = await import('path')
    
    const requestPath = new URL(c.req.url).pathname
    let filePath = path.join(process.cwd(), 'client/dist', requestPath === '/' ? 'index.html' : requestPath)
    
    // Check if file exists
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath)
      const ext = path.extname(filePath)
      const contentType = getContentType(ext)
      
      return new Response(content, {
        headers: { 'Content-Type': contentType }
      })
    }
    
    // If file not found, serve index.html for SPA routing
    const indexPath = path.join(process.cwd(), 'client/dist', 'index.html')
    if (fs.existsSync(indexPath)) {
      const content = fs.readFileSync(indexPath)
      return new Response(content, {
        headers: { 'Content-Type': 'text/html' }
      })
    }
    
  } catch (e) {
    console.log('Asset serving error:', e)
  }
  
  // Fallback for development or when no assets binding
  return c.json({ 
    message: 'Alislam Q&A API Server',
    endpoints: {
      chat: '/api/chat',
      agent: '/api/agent',
      health: '/api/health'
    }
  })
})

// Helper function to get content type based on file extension
function getContentType(ext: string): string {
  const contentTypes: { [key: string]: string } = {
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'application/javascript',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
    '.ttf': 'font/ttf',
    '.eot': 'application/vnd.ms-fontobject'
  }
  
  return contentTypes[ext] || 'application/octet-stream'
}

export default app 