import { ChatGoogleGenerativeAI } from '@langchain/google-genai'
import { createReactAgent } from '@langchain/langgraph/prebuilt'
import { createSearchCommentaryTool } from '../tools/search_commentary'
import { createFindVerseTool } from '../tools/find_verse'
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
  private llm: ChatGoogleGenerativeAI | null = null
  private agents: Map<string, any> = new Map()

  private constructor() {}

  public static getInstance(): AgentService {
    if (!AgentService.instance) {
      AgentService.instance = new AgentService()
    }
    return AgentService.instance
  }

  private initializeLLM(env: AgentBindings) {
    if (!this.llm) {
      this.llm = new ChatGoogleGenerativeAI({
        apiKey: env.GEMINI_API_KEY,
        modelName: 'gemini-2.5-pro-preview-05-06',
        temperature: 0.7,
        streaming: false
      })
    }
  }

  private createAgent(env: AgentBindings, namespace: string) {
    // Use namespace as cache key to ensure each namespace gets its own agent
    const cacheKey = namespace
    
    if (!this.agents.has(cacheKey)) {
      this.initializeLLM(env)
      
      // Create the search commentary tool using the separate module
      const search_commentary = createSearchCommentaryTool({
        GEMINI_API_KEY: env.GEMINI_API_KEY,
        PINECONE_API_KEY: env.PINECONE_API_KEY,
        COHERE_API_KEY: env.COHERE_API_KEY,
      }, namespace)
      
      // Create the find verse tool
      const find_verse = createFindVerseTool()
      
      // Simplified prompt that's more compatible with Google AI
      const prompt = namespace === 'tafseer-hazrat-masih-maud' ? tafseerHazratMasihMaudPrompt : fiveVolumeCommentaryPrompt

      const agent = createReactAgent({
        llm: this.llm!,
        tools: [search_commentary, find_verse],
        prompt: prompt
      })
      
      this.agents.set(cacheKey, agent)
    }
    
    return this.agents.get(cacheKey)
  }

  public async *processAlislamQuery(prompt: string, namespace: string, env: AgentBindings): AsyncGenerator<string, void, unknown> {
    try {
      if (!prompt || prompt.trim() === "") {
        prompt = "Please provide a question about Islam or the Quran."
      }

      const agent = this.createAgent(env, namespace)
      
      // Use stream for streaming responses
      const inputs = {
        messages: [{ role: "user", content: prompt }],
      };
      
      const stream = await agent.stream(inputs, 
        { configurable: { thread_id: "agent-session" } },
        { streamMode: "messages" }
      );
      
      try {
        for await (const chunk of stream) {
          try {
            // LangGraph returns chunks as { nodeName: nodeOutput }
            if (typeof chunk === 'object' && chunk !== null) {
              for (const [nodeName, nodeOutput] of Object.entries(chunk)) {
                // Process agent outputs
                if (nodeName === 'agent' && nodeOutput && typeof nodeOutput === 'object') {
                  const output = nodeOutput as any
                  console.log(chunk)
                  
                  // Extract messages from the agent output
                  if (output.messages && Array.isArray(output.messages)) {
                    for (const message of output.messages) {
                      // Check for tool calls in the message
                      if (message && message.tool_calls && Array.isArray(message.tool_calls) && message.tool_calls.length > 0) {
                        for (const toolCall of message.tool_calls) {
                          // Emit a structured tool call format that's easier to parse
                          // Use single-line JSON to avoid parsing issues
                          const toolCallMessage = `🔧 **Tool Call**: ${toolCall.name}\n📝 **Arguments**: ${JSON.stringify(toolCall.args)}\n\n`
                          yield toolCallMessage
                        }
                      }
                      
                      // Check if this is an AI message with content
                      if (message && typeof message.content === 'string' && message.content.trim()) {
                        // Check if this message has tool calls - if not, it's likely the final answer
                        const hasToolCalls = message.tool_calls && Array.isArray(message.tool_calls) && message.tool_calls.length > 0
                        
                        if (!hasToolCalls) {
                          // This is the final answer - mark it with a special prefix
                          yield `📝 **Final Answer**:\n${message.content}`
                        } else {
                          // This is intermediate content with tool calls - yield as is
                          yield message.content
                        }
                      }
                    }
                  }
                }
              }
            }
          } catch (chunkError) {
            console.warn('Error processing chunk:', chunkError)
            // Continue processing other chunks
          }   
        }
      } catch (streamError) {
        console.error('Stream processing error:', streamError)
        yield `Error processing stream: ${streamError instanceof Error ? streamError.message : 'Unknown error'}`
      }

    } catch (error) {
      console.error('Agent processing error:', error)
      
      // Provide more specific error messages
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
      
      yield errorMessage
    }
  }

  public validateEnvironment(env: AgentBindings): boolean {
    return !!(env.GEMINI_API_KEY && env.PINECONE_API_KEY && env.COHERE_API_KEY)
  }
} 