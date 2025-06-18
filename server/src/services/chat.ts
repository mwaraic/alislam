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
  PINECONE_API_KEY: string
  PINECONE_INDEX: string
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

  private async createRAGChain(env: ChatBindings, indexName: string, namespace: string, displayName: string, format: string) {
    // Initialize Gemini components
    const llm = new ChatGoogleGenerativeAI({
      apiKey: env.GEMINI_API_KEY,
      modelName: 'gemini-2.5-flash-lite-preview-06-17',
      temperature: 0.7,
      streaming: true,
    })

    const embeddings = new GoogleGenerativeAIEmbeddings({
      apiKey: env.GEMINI_API_KEY,
      modelName: 'gemini-embedding-exp-03-07',
    })

    // Initialize Pinecone
    const pinecone = this.initializePinecone(env.PINECONE_API_KEY)
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

    const prompt = PromptTemplate.fromTemplate(`You are an Ahmadi scholar who answer general questions.

Guidelines:
- Use the following books from ${displayName} to answer questions.
- Add inline references and new.alislam.org web links to the sources of the answer in the format: (${format}) https://new.alislam.org/library/books/<book-id>?option=options&page=<page-number>
- If the answer is not found in the books, say "I didn't find the answer in the ${displayName} collection"
- Add صَلَّى اللهُ عَلَيْهِ وَسَلَّمَ when Prophet Muhammad is mentioned
- Add عَلَيْهِ السَّلَّامُ when other prophets are mentioned

Question: {question}
Books from ${displayName}: {context}
Answer:`)

    // Create the RAG chain using RunnableSequence
    return RunnableSequence.from([
      {
        context: async (input: { question: string }) => {
          const docs = await retriever.invoke(input.question)
          return docs.map((doc: Document) => doc.pageContent+`\n\nLink:${doc.metadata.link}`).join('\n\n')
        },
        question: (input: { question: string }) => input.question,
      },
      prompt,
      llm,
      new StringOutputParser(),
    ])
  }

  public async getRAGChain(env: ChatBindings, indexName: string, namespace: string = '__default__', displayName: string, format: string) {
    const cacheKey = `${env.PINECONE_INDEX}-${indexName}-${namespace}`
    
    if (!this.ragChains.has(cacheKey)) {
      const chain = await this.createRAGChain(env, indexName, namespace, displayName, format)
      this.ragChains.set(cacheKey, chain)
    }
    
    return this.ragChains.get(cacheKey)
  }

  public validateIndex(index: string | undefined): string {
    const validIndexes = ['ruhani-khazain-v2', 'ruhani-khazain', 'fiqh', 'seerat-ul-mahdi', 'pocket-book']
    return index && validIndexes.includes(index) ? index : 'ruhani-khazain'
  }

  public validateEnvironment(env: ChatBindings): boolean {
    return !!(env.GEMINI_API_KEY && env.PINECONE_API_KEY)
  }
} 