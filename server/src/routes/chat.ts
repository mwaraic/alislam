import { Hono } from 'hono'
import { ChatService, ChatBindings } from '../services/chat'

type Variables = {
  env?: ChatBindings
}

export const chatRoute = new Hono<{ Bindings: ChatBindings; Variables: Variables }>()

// Debug middleware to log all requests
chatRoute.use('*', async (c, next) => {
  console.log('Incoming request:', {
    method: c.req.method,
    url: c.req.url,
    headers: Object.fromEntries(c.req.raw.headers.entries())
  })
  await next()
})

// Handle OPTIONS preflight requests
chatRoute.options('/', (c) => {
  console.log('Handling OPTIONS request')
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': 'http://localhost:5173',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400',
    }
  })
})

// POST /api/chat - Handle chat messages with streaming
chatRoute.post('/', async (c) => {
  try {
    const env = c.get('env') || c.env
    const { message, index, namespace, displayName, format } = await c.req.json()

    if (!message || typeof message !== 'string') {
      return c.json({ error: 'Valid message string is required' }, 400)
    }

    const chatService = ChatService.getInstance()
    const selectedIndex = chatService.validateIndex(index)
    const selectedNamespace = namespace || '__default__'
    
    // Debug: Log environment variable status (without exposing actual keys)
    console.log('Environment variables check:')
    console.log('GEMINI_API_KEY:', env.GEMINI_API_KEY ? `Set (${env.GEMINI_API_KEY.substring(0, 10)}...)` : '❌ GEMINI_API_KEY not set or invalid')
    console.log('PINECONE_API_KEY:', env.PINECONE_API_KEY ? `Set (${env.PINECONE_API_KEY.substring(0, 10)}...)` : '❌ PINECONE_API_KEY not set or invalid')
    console.log('PINECONE_INDEX:', env.PINECONE_INDEX ? `Set (${env.PINECONE_INDEX})` : '❌ PINECONE_INDEX not set or invalid')
    console.log('Selected Index:', selectedIndex)
    console.log('Selected Namespace:', selectedNamespace)

    // Validate environment variables
    if (!chatService.validateEnvironment(env)) {
      return c.json({ error: 'Missing required environment variables' }, 500)
    }

    // Get RAG chain with selected index
    const ragChain = await chatService.getRAGChain(env, selectedIndex, selectedNamespace, displayName, format)

    // Create a readable stream for streaming response
    const { readable, writable } = new TransformStream()
    const writer = writable.getWriter()
    const encoder = new TextEncoder()

    // Start the streaming process
    ;(async () => {
      try {
        console.log('Starting streaming for question:', String(message).trim())
        
        // Use streamEvents to get token-level streaming from the LLM
        const eventStream = ragChain.streamEvents({
          question: String(message).trim()
        }, { version: "v1" })

        console.log('Got event stream, starting to iterate...')
        let chunkCount = 0
        let totalChars = 0
        
        for await (const event of eventStream) {
          // Look for LLM streaming events which contain the actual content
          if (event.event === "on_llm_stream") {
            const chunk = event.data?.chunk?.content || event.data?.chunk?.text || event.data?.chunk
            
            if (chunk && typeof chunk === 'string' && chunk.length > 0) {
              chunkCount++
              totalChars += chunk.length
              
              console.log(`Streaming chunk ${chunkCount}: "${chunk}" (${chunk.length} chars)`)
              
              // Prevent infinite streaming (safety measure)
              if (chunkCount > 200) {
                console.log('🛑 Stopping stream after 200 chunks to prevent infinite loop')
                break
              }
              
              // Write chunk immediately
              const encodedChunk = encoder.encode(chunk)
              await writer.write(encodedChunk)
              
              // Add a very small delay to ensure smooth delivery
              await new Promise(resolve => setTimeout(resolve, 1))
            }
          }
        }
        
        console.log(`✅ Streaming completed successfully. Total chunks: ${chunkCount}, total chars: ${totalChars}`)
      } catch (error) {
        console.error('❌ Streaming error:', error)
        const errorMessage = 'Sorry, there was an error processing your request. Please try again.'
        await writer.write(encoder.encode(errorMessage))
      } finally {
        try {
          console.log('🔒 Closing writer...')
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
    console.error('Chat error:', error)
    
    // Return different error messages based on error type
    if (error instanceof Error) {
      if (error.message.includes('Pinecone')) {
        return c.json({ error: 'Database connection error. Please try again.' }, 500)
      }
      if (error.message.includes('Gemini') || error.message.includes('Google')) {
        return c.json({ error: 'AI service unavailable. Please try again.' }, 500)
      }
      if (error.message.includes('text.replace')) {
        return c.json({ error: 'Input processing error. Please try rephrasing your question.' }, 500)
      }
    }
    
    return c.json({ 
      error: 'An unexpected error occurred. Please try again.' 
    }, 500)
  }
}) 