import { ChatGoogleGenerativeAI, GoogleGenerativeAIEmbeddings } from '@langchain/google-genai'
import { Pinecone } from '@pinecone-database/pinecone'
import { CohereRerank } from '@langchain/cohere'
import { tool } from '@langchain/core/tools'
import { z } from 'zod'

export type SearchCommentaryBindings = {
  GEMINI_API_KEY: string
  PINECONE_API_KEY: string
  COHERE_API_KEY: string
}

interface SparseEmbeddingResponse {
  q_indices: number[]
  q_values: number[]
  query: string
}

export class SearchCommentaryTool {
  private embeddings: GoogleGenerativeAIEmbeddings | null = null
  private pinecone: Pinecone | null = null
  private reranker: CohereRerank | null = null

  constructor(private env: SearchCommentaryBindings, private namespace: string) {
    this.initializeServices()
  }

  private initializeServices() {
    if (!this.embeddings) {
      this.embeddings = new GoogleGenerativeAIEmbeddings({
        apiKey: this.env.GEMINI_API_KEY,
        modelName: 'gemini-embedding-exp-03-07',
      })
    }

    if (!this.pinecone) {
      this.pinecone = new Pinecone({
        apiKey: this.env.PINECONE_API_KEY,
      })
    }

    if (!this.reranker) {
      this.reranker = new CohereRerank({
        apiKey: this.env.COHERE_API_KEY,
        model: "rerank-multilingual-v3.0",
        topN: 25
      })
    }
  }

  private async getSparseEmbedding(query: string): Promise<SparseEmbeddingResponse> {
    const maxRetries = 3
    const baseDelay = 1000 // 1 second
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const response = await fetch('https://embedding-service.tickrbot.workers.dev/embedding', {
          method: 'POST',
          body: JSON.stringify({ query }),
          headers: {
            'Content-Type': 'application/json'
          }
        })

        // If we get a 500 error and haven't exceeded max retries, retry with exponential backoff
        if (response.status === 500 && attempt < maxRetries) {
          const delay = baseDelay * Math.pow(2, attempt)
          console.warn(`Sparse embedding service returned 500, retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries + 1})`)
          await new Promise(resolve => setTimeout(resolve, delay))
          continue
        }

        // If response is not ok and it's not a 500 we want to retry, throw error
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`)
        }

        const data = await response.json() as { q_indices?: number[], q_values?: number[] }

        return {
          q_indices: data?.q_indices || [],
          q_values: data?.q_values || [],
          query: query
        }
      } catch (error) {
        // If this is the last attempt or it's not a network/500 error, give up
        if (attempt === maxRetries) {
          console.warn('Sparse embedding service unavailable after retries:', error)
          return {
            q_indices: [],
            q_values: [],
            query: query
          }
        }
        
        // For other errors (network issues, etc.), retry with exponential backoff
        const delay = baseDelay * Math.pow(2, attempt)
        console.warn(`Sparse embedding request failed, retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries + 1}):`, error)
        await new Promise(resolve => setTimeout(resolve, delay))
      }
    }

    // This should never be reached, but TypeScript needs it
    return {
      q_indices: [],
      q_values: [],
      query: query
    }
  }

  private mergeResults(denseMatches: any[], sparseMatches: any[]): any[] {
    const uniqueResults = new Map<string, any>()
    
    // Process dense results
    denseMatches.forEach(match => {
      const text = match.metadata?.text?.trim() || ''
      if (text && !uniqueResults.has(text)) {
        uniqueResults.set(text, {
          chunk_text: text,
          _score: match.score || 0,
          link: match.metadata?.link,
          page: match.metadata?.page,
          title: match.metadata?.title,
          source: 'dense'
        })
      }
    })

    // Process sparse results
    sparseMatches.forEach(match => {
      const text = match.metadata?.text?.trim() || ''
      if (text) {
        const existing = uniqueResults.get(text)
        const newScore = match.score || 0
        if (!existing || newScore > existing._score) {
          uniqueResults.set(text, {
            chunk_text: text,
            _score: newScore,
            link: match.metadata?.link,
            page: match.metadata?.page,
            title: match.metadata?.title,
            source: 'sparse'
          })
        }
      }
    })

    // Sort by score descending
    return Array.from(uniqueResults.values()).sort((a, b) => b._score - a._score)
  }

  private async getEnhancedContext(results: any[], index: any): Promise<any[]> {
    const enhancedResults: any[] = []
    
    for (const result of results) {
      if (!result.page) continue
      
      const currentPage = parseInt(result.page.toString())
      const pages = [
        (currentPage - 1).toString(),
        currentPage.toString(),
        (currentPage + 1).toString()
      ]

      try {
        const dummyVector = new Array(3072).fill(0.0)
        const contextResults = await index.query({
          vector: dummyVector,
          topK: 3,
          filter: {
            page: { $in: pages }
          },
          includeMetadata: true
        })

        enhancedResults.push(...(contextResults.matches || []))
      } catch (error) {
        console.warn('Failed to get enhanced context for page', result.page, error)
        // Fallback to original result
        enhancedResults.push({
          metadata: {
            text: result.chunk_text,
            link: result.link,
            page: result.page,
            title: result.title
          }
        })
      }
    }

    return enhancedResults
  }

  private formatResults(results: any[]): string[] {
    const formattedResults = results.map(doc => {
      const content = doc.metadata?.text || ''
      let link = doc.metadata?.link || ''
      
      if (link) {
        // Replace 'page=' with 'code=' in the link
        link = link.replace('page=', 'code=')
      }
      
      return `Content:${content} \n\nLink:${link}`
    })
    
    return formattedResults
  }

  public async searchCommentary(query: string): Promise<string> {
    try {
      if (!this.embeddings || !this.pinecone || !this.reranker) {
        return 'Services not properly initialized. Please try again.'
      }

      // Dense search using the main index
      const denseIndex = this.pinecone.Index('jamaat-literature').namespace(this.namespace)
      const queryEmbedding = await this.embeddings.embedQuery(query)
      
      const denseResults = await denseIndex.query({
        vector: queryEmbedding,
        topK: 25,
        includeMetadata: true,
        includeValues: false
      })

      // Sparse search using the sparse index
      const sparseIndex = this.pinecone.Index('jamaat-literature-v3').namespace(this.namespace)
      const sparseEmbedding = await this.getSparseEmbedding(query)
      let sparseResults: any = { matches: [] }

      // Only perform sparse search if we have valid sparse embeddings
      if (sparseEmbedding.q_indices.length > 0 && sparseEmbedding.q_values.length > 0) {
        try {
          // Fix the sparse search query by providing a dummy dense vector
          sparseResults = await sparseIndex.query({
            topK: 25,
            sparseVector: {
              indices: sparseEmbedding.q_indices,
              values: sparseEmbedding.q_values
            },
            includeMetadata: true,
          })
        } catch (error) {
          console.error('Sparse search failed:', error)
          // Continue with empty sparse results
        }
      }

      // Merge and deduplicate results
      const mergedResults = this.mergeResults(denseResults.matches || [], sparseResults.matches || [])
      
      if (mergedResults.length === 0) {
        return 'No relevant commentary found for this query.'
      }

      // Rerank results
      const documentsForReranking = mergedResults.map(result => result.chunk_text).filter(text => text && text.trim())
      
      if (documentsForReranking.length === 0) {
        return 'No valid commentary content found for reranking.'
      }

      const rerankedResults = await this.reranker!.rerank(documentsForReranking, query, { topN: 5 })
      
      // Map reranked indices back to original results
      const rerankedMergedResults = rerankedResults.map(r => mergedResults[r.index]).filter(Boolean)
      
      // Get enhanced context by fetching adjacent pages
      const enhancedResults = await this.getEnhancedContext(
        rerankedMergedResults,
        denseIndex
      )

      // Format results and return as a single string
      const formattedResults = this.formatResults(enhancedResults)

      return formattedResults.join('\n\n---\n\n') || 'No commentary content found.'
      
    } catch (error) {
      console.error('Search commentary error:', error)
      return `Search failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    }
  }

  public createTool() {
    return tool(
      async (input: { query: string }) => {
        return await this.searchCommentary(input.query)
      },
      {
        name: 'search_commentary',
        description: 'Search the commentary for the given query.',
        schema: z.object({
          query: z.string().describe('The query to search the commentary for.')
        })
      }
    )
  }
}

// Factory function to create the tool
export function createSearchCommentaryTool(env: SearchCommentaryBindings, namespace: string) {
  const searchTool = new SearchCommentaryTool(env, namespace)
  return searchTool.createTool()
}
