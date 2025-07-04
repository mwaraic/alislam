import { GoogleGenerativeAIEmbeddings } from '@langchain/google-genai'
import { PineconeStore } from '@langchain/pinecone'
import { Pinecone } from '@pinecone-database/pinecone'
import { Document } from '@langchain/core/documents'
import { CohereRerank } from '@langchain/cohere'
import { ContextualCompressionRetriever } from 'langchain/retrievers/contextual_compression'
import { BaseRetrieverInterface } from '@langchain/core/retrievers'
import { GoogleGenAI } from '@google/genai'

export type ChatBindings = {
  GEMINI_API_KEY: string
  PINECONE_API_KEY_2: string
  COHERE_API_KEY: string
}

export class ChatService {
  private static instance: ChatService
  private ragChains: Map<string, any> = new Map()

  private constructor() {}

  public static getInstance(): ChatService {
    if (!ChatService.instance) {
      ChatService.instance = new ChatService()
    }
    return ChatService.instance
  }

  private initializePinecone(apiKey: string): Pinecone {
    return new Pinecone({
      apiKey: apiKey,
    })
  }

  private async retrieveAndExpandDocuments(
    question: string, 
    retriever: ContextualCompressionRetriever, 
    index: any
  ): Promise<Document[]> {
    // Retrieve initial context using similarity search and reranking
    const docs = await retriever.invoke(question)
    console.log('Retrieved documents:', docs)
    
    // Extract unique pages and volumes from retrieved documents
    const volumePages = new Map<string, Set<string>>()
    
    docs.forEach((doc: Document) => {
      if (doc.metadata?.page && doc.metadata?.volume) {
        const pageNum = doc.metadata.page
        const volume = doc.metadata.volume
        
        // Convert string page to number for arithmetic, then back to string
        const currentPageNum = parseInt(pageNum.toString())
        
        if (!isNaN(currentPageNum)) {
          if (!volumePages.has(volume)) {
            volumePages.set(volume, new Set())
          }
          
          // Add current page and adjacent pages (±1)
          const pages = volumePages.get(volume)!
          if (currentPageNum > 1) pages.add((currentPageNum - 1).toString()) // Previous page
          pages.add(currentPageNum.toString())     // Current page
          pages.add((currentPageNum + 1).toString()) // Next page
        }
      }
    })
    
    console.log('Volume pages map:', Array.from(volumePages.entries()).map(([vol, pages]) => 
      [vol, Array.from(pages)]
    ))
    
    // Query Pinecone for additional context pages
    let additionalDocs: Document[] = []
    
    for (const [volume, pages] of Array.from(volumePages.entries())) {
      const validPages = Array.from(pages).filter((p: string) => {
        const pageNum = parseInt(p)
        return !isNaN(pageNum) && pageNum > 0
      }) // Remove invalid pages
      
      if (validPages.length > 0) {
        const dummy_vector = new Array(3072).fill(0.0)
        
        try {
          const result = await index.query({
            vector: dummy_vector,
            topK: Math.min(validPages.length * 3, 100), // Increase limit
            filter: {
              volume: { $eq: volume },
              page: { $in: validPages }
            },
            includeMetadata: true
          })
          
          if (result.matches) {
            result.matches.forEach((match: any) => {
              // The content might be in different locations depending on how data was stored
              let pageContent = ''
              const metadata = match.metadata as Record<string, any>
              
              if (metadata?.pageContent && typeof metadata.pageContent === 'string') {
                pageContent = metadata.pageContent
              } else if (metadata?.text && typeof metadata.text === 'string') {
                pageContent = metadata.text
              } else if (metadata?.content && typeof metadata.content === 'string') {
                pageContent = metadata.content
              }
              
              if (pageContent && metadata) {
                additionalDocs.push({
                  pageContent: pageContent,
                  metadata: metadata
                })
              }
            })
          }
        } catch (error) {
          console.error('Error querying Pinecone for additional pages:', error)
        }
      }
    }
              
    // Combine original docs with additional context pages
    const allDocs = [...docs, ...additionalDocs]
    
    console.log('Total docs before deduplication:', allDocs.length)
    
    // Remove duplicates based on page and volume
    const uniqueDocs = Array.from(
      new Map(
        allDocs.map(doc => [
          `${doc.metadata?.volume || 'unknown'}-${doc.metadata?.page || 'unknown'}`,
          doc
        ])
      ).values()
    )
    
    // Sort documents by volume and then by page number
    uniqueDocs.sort((a, b) => {
      const volumeA = a.metadata?.volume || 'unknown'
      const volumeB = b.metadata?.volume || 'unknown'
      
      // First sort by volume
      if (volumeA !== volumeB) {
        return volumeA.localeCompare(volumeB)
      }
      
      // Then sort by page number within the same volume
      const pageA = parseInt(a.metadata?.page?.toString() || '0')
      const pageB = parseInt(b.metadata?.page?.toString() || '0')
      
      return pageA - pageB
    })

    console.log('Unique docs:', uniqueDocs.length)
    return uniqueDocs
  }

  private async createRAGChain(env: ChatBindings, indexName: string, namespace: string, displayName: string, description: string, format: string) {
    // Initialize GenAI client
    const ai = new GoogleGenAI({
      apiKey: env.GEMINI_API_KEY
    })

    const embeddings = new GoogleGenerativeAIEmbeddings({
      apiKey: env.GEMINI_API_KEY,
      modelName: 'gemini-embedding-exp-03-07',
    })

    // Initialize Pinecone
    const pinecone = this.initializePinecone(env.PINECONE_API_KEY_2)
    const index = pinecone.Index(indexName)

    // Create vector store with namespace
    const vectorStore = await PineconeStore.fromExistingIndex(embeddings, {
      pineconeIndex: index,
      namespace: namespace !== '__default__' ? namespace : undefined
    })

    // Initialize CohereRerank
    const reranker = new CohereRerank({
      apiKey: env.COHERE_API_KEY,
      model: "rerank-multilingual-v3.0",
      topN: 5
    })

    // Create base retriever with similarity search
    const similarityRetriever = vectorStore.asRetriever({
      searchType: "similarity",
      k: 50
    }) as unknown as BaseRetrieverInterface

    // Create contextual compression retriever
    const retriever = new ContextualCompressionRetriever({
      baseCompressor: reranker,
      baseRetriever: similarityRetriever
    })

    // Return the configured components for this index/namespace
    return {
      ai,
      retriever,
      index,
      displayName,
      description,
      format
    }
  }

  public async* answerQuestion(
    question: string,
    env: ChatBindings,
    indexName: string,
    namespace: string = '__default__',
    displayName: string,
    description: string,
    format: string
  ): AsyncGenerator<any, void, unknown> {
    // Get or create the RAG components
    const cacheKey = `${indexName}-${namespace}`
    console.log('Cache key:', cacheKey)
    if (!this.ragChains.has(cacheKey)) {
      const components = await this.createRAGChain(env, indexName, namespace, displayName, description, format)
      this.ragChains.set(cacheKey, components)
    }
    
    const { ai, retriever, index, displayName: cachedDisplayName, description: cachedDescription, format: cachedFormat } = this.ragChains.get(cacheKey)
        
    try {
      // Retrieve and expand documents
      const docs = await this.retrieveAndExpandDocuments(question, retriever, index)
      console.log('Docs:', docs)
      const context = docs.map((doc: Document) => 
        `Content:${doc.pageContent} \n\nLink:${doc.metadata?.link?.replace('page=', 'code=') || ''}`
      ).join('\n\n')

      console.log('Context:', context)

      // Create the prompt
      const prompt = `You are an Ahmadi Muslim scholar answering questions from authoritative Ahmadiyya literature.

      Guidelines:
      - Use ${cachedDisplayName}: ${cachedDescription} as your primary source
      - Ignore irrelevant retrieved content
      - Always cite: (${cachedFormat}) https://new.alislam.org/library/books/<book-id>?option=options&code=<link-code>
      - Add صَلَّى اللهُ عَلَيْهِ وَسَلَّمَ after Prophet Muhammad
      - Add عَلَيْهِ السَّلَّامُ after other prophets
      - Begin responses with بِسْمِ ٱللَّٰهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ
      - Write with authority using declarative statements
      - Include original text (Arabic/Urdu) with translations when helpful
      - If no answer found, state: "I didn't find the answer in the ${cachedDisplayName} collection"
      
      Question: ${question}
      ${cachedDisplayName}: ${context}
      Answer:`

      // Use streaming API for true token-by-token streaming
      const stream = await ai.models.generateContentStream({
        model: "gemini-2.5-pro-preview-05-06",
        contents: [{ parts: [{ text: prompt }] }],
        config: {
          thinkingConfig: {
            includeThoughts: true,
          },
          temperature: 0.7,
        }
      })

      console.log('Stream object:', stream)

      // Process the streaming response - iterate directly over the stream
      // The @google/genai package returns a Promise that resolves to an async iterable
      for await (const chunk of stream) {
        console.log('Received chunk:', chunk)
        
        // Check if chunk has candidates with content
        if (chunk.candidates && chunk.candidates[0] && chunk.candidates[0].content && chunk.candidates[0].content.parts) {
          for (const part of chunk.candidates[0].content.parts) {
            if (!part.text) {
              continue;
            }
            else if (part.thought) {
              // This is thinking content - stream it token by token
              yield { type: 'thinking', content: part.text }
            }
            else {
              // This is the actual answer - stream it token by token
              yield { type: 'answer', content: part.text }
            }
          }
        }
      }
      
    } catch (error) {
      console.error('Error generating response:', error)
      yield { type: 'error', content: 'Failed to generate response' }
    }
  }

  public async getRAGChain(env: ChatBindings, indexName: string, namespace: string = '__default__', displayName: string, description: string, format: string) {
    // Return a function that calls answerQuestion
    return async (question: string) => {
      return this.answerQuestion(question, env, indexName, namespace, displayName, description, format)
    }
  }

  public validateIndex(index: string | undefined): string {
    const validIndexes = ['ruhani-khazain-v2', 'ruhani-khazain', 'fiqh', 'seerat-ul-mahdi', 'pocket-book', 'ahmadiyya-literature']
    return index && validIndexes.includes(index) ? index : 'ruhani-khazain'
  }

  public validateEnvironment(env: ChatBindings): boolean {
    return !!(env.GEMINI_API_KEY && env.PINECONE_API_KEY_2)
  }
} 