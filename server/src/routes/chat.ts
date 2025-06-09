import { Hono } from 'hono'
import { ChatGoogleGenerativeAI, GoogleGenerativeAIEmbeddings } from '@langchain/google-genai'
import { PineconeStore } from '@langchain/pinecone'
import { Pinecone } from '@pinecone-database/pinecone'
import { PromptTemplate } from '@langchain/core/prompts'
import { RunnableSequence } from '@langchain/core/runnables'
import { StringOutputParser } from '@langchain/core/output_parsers'
import { Document } from '@langchain/core/documents'

type Bindings = {
  GEMINI_API_KEY: string
  PINECONE_API_KEY: string
  PINECONE_INDEX: string
}

type Variables = {
  env?: Bindings
}

export const chatRoute = new Hono<{ Bindings: Bindings; Variables: Variables }>()

// CORS preflight handler
chatRoute.options('/', async (c) => {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400',
    }
  })
})

// Initialize Pinecone client
const initializePinecone = (apiKey: string) => {
  return new Pinecone({
    apiKey: apiKey,
  })
}

// Create RAG chain using invoke pattern
const createRAGChain = async (env: Bindings) => {
  // Initialize Gemini components
  const llm = new ChatGoogleGenerativeAI({
    apiKey: env.GEMINI_API_KEY,
    modelName: 'gemini-2.5-flash-preview-05-20',
    temperature: 0.7,
    streaming: true,
  })

  const embeddings = new GoogleGenerativeAIEmbeddings({
    apiKey: env.GEMINI_API_KEY,
    modelName: 'gemini-embedding-exp-03-07',
  })

  // Initialize Pinecone
  const pinecone = initializePinecone(env.PINECONE_API_KEY)
  const index = pinecone.Index(env.PINECONE_INDEX)

  // Create vector store
  const vectorStore = await PineconeStore.fromExistingIndex(embeddings, {
    pineconeIndex: index,
  })

  // Create retriever
  const retriever = vectorStore.asRetriever({
    k: 3, // Number of documents to retrieve
  })

  // Create prompt template
  const prompt = PromptTemplate.fromTemplate(`
You are an Ahmadi scholar who answer general questions.
Use the following books of the Promised Messiah A.S to answer questions.
Add references to the sources of the answer for example: Ruhani Khazain Vol. X Pg. X

Question: {question}
Books: {context}
Answer:`)

  // Create the RAG chain using RunnableSequence with proper types
  const ragChain = RunnableSequence.from([
    {
      context: async (input: { question: string }) => {
        const docs = await retriever.invoke(input.question)
        return docs.map((doc: Document) => doc.pageContent).join('\n\n')
      },
      question: (input: { question: string }) => input.question,
    },
    prompt,
    llm,
    new StringOutputParser(),
  ])

  return ragChain
}

// POST /api/chat - Handle chat messages with streaming
chatRoute.post('/', async (c) => {
  try {
    const env = c.get('env') || c.env
    const { message } = await c.req.json()

    if (!message || typeof message !== 'string') {
      return c.json({ error: 'Valid message string is required' }, 400)
    }

    // Debug: Log environment variable status (without exposing actual keys)
    console.log('Environment variables check:')
    console.log('GEMINI_API_KEY:', env.GEMINI_API_KEY ? `Set (${env.GEMINI_API_KEY.substring(0, 10)}...)` : '❌ GEMINI_API_KEY not set or invalid')
    console.log('PINECONE_API_KEY:', env.PINECONE_API_KEY ? `Set (${env.PINECONE_API_KEY.substring(0, 10)}...)` : '❌ PINECONE_API_KEY not set or invalid')
    console.log('PINECONE_INDEX:', env.PINECONE_INDEX ? `Set (${env.PINECONE_INDEX})` : '❌ PINECONE_INDEX not set or invalid')

    // Validate environment variables
    if (!env.GEMINI_API_KEY || !env.PINECONE_API_KEY || !env.PINECONE_INDEX) {
      return c.json({ error: 'Missing required environment variables' }, 500)
    }

    // Create RAG chain
    const ragChain = await createRAGChain(env)

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