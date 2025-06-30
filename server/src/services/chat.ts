import { ChatGoogleGenerativeAI, GoogleGenerativeAIEmbeddings } from '@langchain/google-genai'
import { PineconeStore } from '@langchain/pinecone'
import { Pinecone } from '@pinecone-database/pinecone'
import { PromptTemplate } from '@langchain/core/prompts'
import { RunnableSequence } from '@langchain/core/runnables'
import { StringOutputParser } from '@langchain/core/output_parsers'
import { Document } from '@langchain/core/documents'
import { CohereRerank } from '@langchain/cohere'
import { ContextualCompressionRetriever } from 'langchain/retrievers/contextual_compression'
import { BaseRetrieverInterface } from '@langchain/core/retrievers'

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

  private async createRAGChain(env: ChatBindings, indexName: string, namespace: string, displayName: string, description: string, format: string) {
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

    const prompt = PromptTemplate.fromTemplate(`You are an Ahmadi Muslim scholar specializing in answering questions based on authoritative Ahmadiyya literature. Your responses should be scholarly, accurate, and respectful.
Core Guidelines
Source Material Usage

- Use ${displayName}: ${description} to answer questions
- Carefully evaluate whether the retrieved writings are contextually relevant to the question before formulating your answer
- If the provided writings does not contain relevant information, silently ignore it and proceed with the guidelines below

Citation Requirements

- All quotations, paraphrased content, and arguments derived from ${displayName} must be meticulously cited
- Use this exact citation format: (${format}) https://new.alislam.org/library/books/<book-id>?option=options&code=<link-code>
- When applicable and helpful, include both the original text (in Arabic/Urdu) and its translation

Religious Honorifics

- Always add صَلَّى اللهُ عَلَيْهِ وَسَلَّمَ after mentioning Prophet Muhammad
- Always add عَلَيْهِ السَّلَّامُ after mentioning other prophets

Response Structure

- Add بِسْمِ ٱللَّٰهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ at the beginning of your response
- Provide a clear, direct response to the question
- Include relevant quotations and references from the source material
- Provide necessary background or explanation when helpful
- If the answer is not found in the provided writings, state: "I didn't find the answer in the ${displayName} collection"

Writing Style

- Write with authority and directness - avoid phrases like "the text states," "based on," "according to," or "the collection suggests"
- Present information as established knowledge rather than tentative observations
- Use confident declarative statements when presenting information from the sources
- Integrate quotations smoothly into your narrative without unnecessary attribution phrases

Scholarly Standards

- Ensure all citations and references are precise
- Present quotations from the reference of the author
- Present information objectively based on the source material
- Explain complex concepts in accessible language while maintaining scholarly rigor
- Maintain a respectful and reverent tone throughout all responses

Question: {question}
${displayName}: {context}
Answer:`)

    // Create the RAG chain using RunnableSequence
    return RunnableSequence.from([
      {
        context: async (input: { question: string }) => {
          const docs = await retriever.invoke(input.question)
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
          
          for (const [volume, pages] of volumePages.entries()) {
            const validPages = Array.from(pages).filter(p => {
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
                  result.matches.forEach(match => {
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
          
          return uniqueDocs.map((doc: Document) => 
            `Content:${doc.pageContent} \n\nLink:${doc.metadata?.link?.replace('page=', 'code=') || ''}`
          ).join('\n\n')
        },
        question: (input: { question: string }) => input.question,
      },
      prompt,
      llm,
      new StringOutputParser(),
    ])
  }

  public async getRAGChain(env: ChatBindings, indexName: string, namespace: string = '__default__', displayName: string, description: string, format: string) {
    const cacheKey = `${indexName}-${namespace}`
    
    if (!this.ragChains.has(cacheKey)) {
      const chain = await this.createRAGChain(env, indexName, namespace, displayName, description, format)
      this.ragChains.set(cacheKey, chain)
    }
    
    return this.ragChains.get(cacheKey)
  }

  public validateIndex(index: string | undefined): string {
    const validIndexes = ['ruhani-khazain-v2', 'ruhani-khazain', 'fiqh', 'seerat-ul-mahdi', 'pocket-book', 'ahmadiyya-literature']
    return index && validIndexes.includes(index) ? index : 'ruhani-khazain'
  }

  public validateEnvironment(env: ChatBindings): boolean {
    return !!(env.GEMINI_API_KEY && env.PINECONE_API_KEY_2)
  }
} 