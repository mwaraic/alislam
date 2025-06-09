import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { chatRoute } from './routes/chat'

type Bindings = {
  GEMINI_API_KEY: string
  PINECONE_API_KEY: string
  PINECONE_ENVIRONMENT: string
  PINECONE_INDEX: string
  ASSETS?: any
}

type Variables = {
  env?: Bindings
}

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>()

// Configure CORS for development and production
app.use('*', cors({
  origin: [
    'http://localhost:5173',  // Vite dev server
    'https://alislam-qa.tickrbot.workers.dev',  // Production URL
    'https://alislam-qa.your-domain.com'  // Custom domain if any
  ],
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
    GEMINI_API_KEY: c.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY,
    PINECONE_API_KEY: c.env.PINECONE_API_KEY || process.env.PINECONE_API_KEY,
    PINECONE_INDEX: c.env.PINECONE_INDEX || process.env.PINECONE_INDEX,
  } as Bindings
  c.set('env', env)
  
  await next()
})

// API routes
app.route('/api/chat', chatRoute)

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
  } catch (e) {
    console.log('Asset serving error:', e)
  }
  
  // Fallback for development or when no assets binding
  return c.json({ 
    message: 'Alislam Q&A API Server',
    endpoints: {
      chat: '/api/chat',
      health: '/api/health'
    }
  })
})

export default app 