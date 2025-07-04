import { GoogleGenAI, Type } from '@google/genai'
import { SearchCommentaryTool } from '../tools/search_commentary'
import { FindVerseTool } from '../tools/find_verse'
import { prompt as fiveVolumeCommentaryPrompt } from '../prompts/five-volume-commentary'
import { prompt as tafseerHazratMasihMaudPrompt } from '../prompts/tafseer-hazrat-masih-maud'

export type AgentBindings = {
  GEMINI_API_KEY: string
  PINECONE_API_KEY: string
  COHERE_API_KEY: string
  NAMESPACE: string
}

export class AgentService {
  private static instance: AgentService
  private ai: GoogleGenAI | null = null
  private searchCommentaryTool: SearchCommentaryTool | null = null
  private findVerseTool: FindVerseTool | null = null

  private constructor() {}

  public static getInstance(): AgentService {
    if (!AgentService.instance) {
      AgentService.instance = new AgentService()
    }
    return AgentService.instance
  }

  private initializeServices(env: AgentBindings, namespace: string) {
    if (!this.ai) {
      this.ai = new GoogleGenAI({
        apiKey: env.GEMINI_API_KEY
      })
    }

    // Always create a new SearchCommentaryTool for the current namespace
    this.searchCommentaryTool = new SearchCommentaryTool({
      GEMINI_API_KEY: env.GEMINI_API_KEY,
      PINECONE_API_KEY: env.PINECONE_API_KEY,
      COHERE_API_KEY: env.COHERE_API_KEY,
    }, namespace)

    if (!this.findVerseTool) {
      this.findVerseTool = new FindVerseTool()
    }
  }

  private getFunctionDeclarations() {
    const searchCommentaryDeclaration = {
      name: 'search_commentary',
      description: 'Search the commentary for the given query to find relevant religious commentary and literature.',
      parameters: {
        type: Type.OBJECT,
        properties: {
          query: {
            type: Type.STRING,
            description: 'The query to search the commentary for.'
          }
        },
        required: ['query']
      }
    }

    const findVerseDeclaration = {
      name: 'find_verse',
      description: 'Find a specific verse from the Holy Quran by chapter and verse number.',
      parameters: {
        type: Type.OBJECT,
        properties: {
          chapter: {
            type: Type.STRING,
            description: 'The chapter number (1-114)'
          },
          verse: {
            type: Type.STRING,
            description: 'The verse number within the chapter'
          }
        },
        required: ['chapter', 'verse']
      }
    }

    return [searchCommentaryDeclaration, findVerseDeclaration]
  }

  private async executeFunctionCall(name: string, args: any): Promise<string> {
    try {
      switch (name) {
        case 'search_commentary':
          if (!this.searchCommentaryTool) {
            return 'Search commentary tool not initialized'
          }
          return await this.searchCommentaryTool.searchCommentary(args.query)
        
        case 'find_verse':
          if (!this.findVerseTool) {
            return 'Find verse tool not initialized'
          }
          return await this.findVerseTool.findVerse(args.chapter, args.verse)
        
        default:
          return `Unknown function: ${name}`
      }
    } catch (error) {
      console.error(`Error executing function ${name}:`, error)
      return `Error executing ${name}: ${error instanceof Error ? error.message : 'Unknown error'}`
    }
  }

  private async *processStreamWithFunctions(
    stream: AsyncIterable<any>,
    env: AgentBindings,
    namespace: string,
    originalPrompt: string
  ): AsyncGenerator<any, void, unknown> {
    const functionCalls: Array<{ name: string; args: any; id?: string }> = []
    let hasToolCalls = false
    
    // First pass: collect all function calls and stream thinking/text
    for await (const chunk of stream) {
      if (chunk.candidates && chunk.candidates[0] && chunk.candidates[0].content) {
        const content = chunk.candidates[0].content
        
        if (content.parts) {
          for (const part of content.parts) {
            if (part.functionCall) {
              hasToolCalls = true
              const functionCall = part.functionCall
              const functionName = functionCall.name || 'unknown'
              functionCalls.push({ name: functionName, args: functionCall.args, id: functionCall.id })
              
              yield { type: 'thinking', content: `🔧 **Tool Call**: ${functionName}\n📝 **Arguments**: ${JSON.stringify(functionCall.args)}\n\n` }
              
            } else if (part.thought) {
              yield { type: 'thinking', content: `${part.text || ''}` }
            } else if (part.text) {
              // This is likely answer content during initial pass, but let's treat as thinking for now
              yield { type: 'thinking', content: part.text }
            }
          }
        }
      }
    }

    // If there were function calls, execute them and get the final response
    if (hasToolCalls && functionCalls.length > 0) {
      yield { type: 'thinking', content: `\n🔧 **Executing ${functionCalls.length} tool call(s)...**\n\n` }
      
      // Execute all function calls sequentially to allow yielding
      const functionResults = []
      for (const call of functionCalls) {
        const result = await this.executeFunctionCall(call.name, call.args)
        yield { type: 'thinking', content: `📊 **${call.name} Result**: ${result.substring(0, 200)}${result.length > 200 ? '...' : ''}\n\n` }
        functionResults.push({
          name: call.name,
          response: { result },
          id: call.id
        })
      }
      
      const systemPrompt = namespace === 'tafseer-hazrat-masih-maud' ? tafseerHazratMasihMaudPrompt : fiveVolumeCommentaryPrompt
      
      // Create a comprehensive prompt with function results
      const contextPrompt = `
${systemPrompt}

User's Original Question: ${originalPrompt}

Based on the following tool results, provide a comprehensive answer to the user's question:

${functionResults.map(result => `
**${result.name}:**
${result.response.result}
`).join('\n')}

Please synthesize this information to directly answer the user's original question: "${originalPrompt}"
`

      const finalStream = await this.ai!.models.generateContentStream({
        model: "gemini-2.5-pro-preview-06-05",
        contents: [{ parts: [{ text: contextPrompt }] }],
        config: {
          temperature: 0.7,
          thinkingConfig: {
            includeThoughts: true,
          }
        }
      })

      // Stream the final response
      for await (const chunk of finalStream) {
        if (chunk.candidates && chunk.candidates[0] && chunk.candidates[0].content) {
          const content = chunk.candidates[0].content
          
          if (content.parts) {
            for (const part of content.parts) {
              if (part.thought) {
                yield { type: 'thinking', content: `${part.text || ''}` }
              } else if (part.text) {
                yield { type: 'answer', content: part.text }
              }
            }
          }
        }
      }
    }
  }

  public async *processAlislamQuery(prompt: string, namespace: string, env: AgentBindings): AsyncGenerator<any, void, unknown> {
    try {
      if (!prompt || prompt.trim() === "") {
        prompt = "Please provide a question about Islam or the Quran."
      }

      this.initializeServices(env, namespace)

      if (!this.ai) {
        yield { type: 'error', content: "Error: AI service not initialized" }
        return
      }

      const systemPrompt = namespace === 'tafseer-hazrat-masih-maud' ? tafseerHazratMasihMaudPrompt : fiveVolumeCommentaryPrompt
      const functionDeclarations = this.getFunctionDeclarations()

      // Single generation call with function calling capability
      const stream = await this.ai.models.generateContentStream({
        model: "gemini-2.5-pro-preview-06-05",
        contents: [{ parts: [{ text: `${systemPrompt}\n\nQuestion: ${prompt}\n\nAnswer:` }] }],
        config: {
          tools: [{
            functionDeclarations: functionDeclarations
          }],
          thinkingConfig: {
            includeThoughts: true,
          },
          temperature: 0.7,
        }
      })

      // Process the stream and handle function calls
      yield* this.processStreamWithFunctions(stream, env, namespace, prompt)

    } catch (error) {
      console.error('Agent processing error:', error)
      
      let errorMessage = 'Error processing Al-Islam query: '
      if (error instanceof Error) {
        if (error.message.includes('Unknown content type')) {
          errorMessage += 'Message format issue. Please try rephrasing your question.'
        } else if (error.message.includes('API')) {
          errorMessage += 'API connection issue. Please try again.'
        } else {
          errorMessage += error.message
        }
      } else {
        errorMessage += 'Unknown error occurred.'
      }
      
      yield { type: 'error', content: errorMessage }
    }
  }

  public validateEnvironment(env: AgentBindings): boolean {
    return !!(env.GEMINI_API_KEY && env.PINECONE_API_KEY && env.COHERE_API_KEY)
  }
}