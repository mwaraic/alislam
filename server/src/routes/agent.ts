import { Hono } from 'hono'
import { AgentService, AgentBindings } from '../services/agent'

type Variables = {
  env?: AgentBindings
}

export const agentRoute = new Hono<{ Bindings: AgentBindings; Variables: Variables }>()

// Debug middleware to log all requests
agentRoute.use('*', async (c, next) => {
  await next()
})

// Handle OPTIONS preflight requests
agentRoute.options('/', (c) => {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400',
    }
  })
})

// POST /api/agent - Handle Al-Islam commentary queries with streaming
agentRoute.post('/', async (c) => {
  try {
    const env = c.get('env') || c.env
    const { prompt, namespace } = await c.req.json()

    if (!prompt || typeof prompt !== 'string') {
      return c.json({ error: 'Valid prompt string is required' }, 400)
    }

    const agentService = AgentService.getInstance()

    // Validate environment variables
    if (!agentService.validateEnvironment(env)) {
      return c.json({ error: 'Missing required environment variables' }, 500)
    }

    // Create a readable stream for streaming response
    const { readable, writable } = new TransformStream()
    const writer = writable.getWriter()
    const encoder = new TextEncoder()

    // Start the streaming process
    ;(async () => {
      try {
        // Use the agent service to process the query with streaming
        const queryGenerator = agentService.processAlislamQuery(prompt.trim(), namespace, env)
        
        for await (const event of queryGenerator) {
          if (event && typeof event === 'object' && event.type && event.content) {
            // Send structured JSON event with type and content
            const structuredEvent = JSON.stringify({
              type: event.type,
              content: event.content
            }) + '\n'
            
            const encodedChunk = encoder.encode(structuredEvent)
            await writer.write(encodedChunk)
            
            // Add a very small delay to ensure smooth delivery
            await new Promise(resolve => setTimeout(resolve, 1))
          } else if (event && typeof event === 'string' && event.length > 0) {
            // Legacy fallback for string events - treat as answer
            const structuredEvent = JSON.stringify({
              type: 'answer',
              content: event
            }) + '\n'
            
            const encodedChunk = encoder.encode(structuredEvent)
            await writer.write(encodedChunk)
            
            // Add a very small delay to ensure smooth delivery
            await new Promise(resolve => setTimeout(resolve, 1))
          }
        }
        
      } catch (error) {
        console.error('Agent streaming error:', error)
        const errorMessage = 'Sorry, there was an error processing your request. Please try again.'
        await writer.write(encoder.encode(errorMessage))
      } finally {
        try {
          await writer.close()
        } catch (closeError) {
          console.error('Error closing writer:', closeError)
        }
      }
    })()

    // Return streaming response with proper headers
    return new Response(readable, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-cache, no-store, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
        'Connection': 'keep-alive',
        'Transfer-Encoding': 'chunked',
        'X-Accel-Buffering': 'no', // Disable nginx buffering
        'X-Content-Type-Options': 'nosniff',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Expose-Headers': 'Content-Type, Cache-Control',
      }
    })

  } catch (error) {
    console.error('Agent error:', error)
    
    // Return different error messages based on error type
    if (error instanceof Error) {
      if (error.message.includes('Pinecone')) {
        return c.json({ error: 'Database connection error. Please try again.' }, 500)
      }
      if (error.message.includes('Gemini') || error.message.includes('Google')) {
        return c.json({ error: 'AI service unavailable. Please try again.' }, 500)
      }
      if (error.message.includes('Services not initialized')) {
        return c.json({ error: 'Service initialization error. Please try again.' }, 500)
      }
    }
    
    return c.json({ 
      error: 'An unexpected error occurred. Please try again.' 
    }, 500)
  }
}) 