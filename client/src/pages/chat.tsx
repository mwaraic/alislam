import { QuestionInput } from '@/components/chat/QuestionInput'
import { AnswerDisplay } from '@/components/chat/AnswerDisplay'
import { ThinkingDisplay } from '@/components/chat/ThinkingDisplay'
import { WelcomeMessage } from '@/components/chat/WelcomeMessage'
import { QuestionTemplates } from '@/components/chat/QuestionTemplates'
import { useState, useMemo } from 'react'
import { flushSync } from 'react-dom'
import booksOptions from '@/data/books'
import tafseerOptions from '@/data/tafseer'

const API_URL = process.env.NODE_ENV === 'production' ? '' : 'http://localhost:8787'

interface ToolCall {
  name: string
  arguments: Record<string, any>
  timestamp?: number
}

export default function ChatPage() {
  const [question, setQuestion] = useState('')
  const [answer, setAnswer] = useState('')
  const [toolCalls, setToolCalls] = useState<ToolCall[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isStreaming, setIsStreaming] = useState(false)
  const [streamingComplete, setStreamingComplete] = useState(false)
  const [isProcessingAnswer, setIsProcessingAnswer] = useState(false)
  const [finalAnswerReceived, setFinalAnswerReceived] = useState(false)
  const [selectedCategory, setSelectedCategory] = useState('tafseer')
  const [selectedIndex, setSelectedIndex] = useState('tafseer-hazrat-masih-maud')
  
  // Timer state variables
  const [responseDuration, setResponseDuration] = useState<number | null>(null)

  // Get current index options based on selected category
  const currentIndexOptions = useMemo(() => {
    return selectedCategory === 'books' ? booksOptions : tafseerOptions
  }, [selectedCategory])

  // Reset selectedIndex when category changes
  const handleCategoryChange = (category: string) => {
    setSelectedCategory(category)
    const newOptions = category === 'books' ? booksOptions : tafseerOptions
    if (newOptions.length > 0) {
      setSelectedIndex(newOptions[0].value)
    }
  }

  const processedAnswer = useMemo(() => {
    if (!answer) return ''
    
    // Clean up markdown formatting
    return answer
      .replace(/```(\w*)\s*/g, '\n\n```$1\n')
      .replace(/\n```\s*/g, '\n```\n\n')
      .replace(/\n{3,}/g, '\n\n')
      .replace(/^\n+/, '')
  }, [answer])

  // Function to parse tool calls from streamed content
  const parseToolCall = (content: string): ToolCall | null => {
    // Look for tool call pattern: 🔧 **Tool Call**: toolName\n📝 **Arguments**: {...}
    const toolCallMatch = content.match(/🔧 \*\*Tool Call\*\*:\s*(.+?)\n📝 \*\*Arguments\*\*:\s*(.+)/s)
    
    if (toolCallMatch) {
      const toolName = toolCallMatch[1].trim()
      let argsString = toolCallMatch[2].trim()
      
      try {
        // Remove any trailing newlines and extra content after the JSON
        const jsonMatch = argsString.match(/(\{.*?\})/s)
        if (jsonMatch) {
          argsString = jsonMatch[1]
        }
        
        const args = JSON.parse(argsString)
        return {
          name: toolName,
          arguments: args,
          timestamp: Date.now()
        }
      } catch (error) {
        console.warn('Failed to parse tool call arguments:', error)
        console.warn('Raw args string:', argsString)
        
        // Try to extract just the query if it's a simple case
        const simpleMatch = argsString.match(/["']?query["']?\s*:\s*["'](.+?)["']/s)
        if (simpleMatch) {
          return {
            name: toolName,
            arguments: { query: simpleMatch[1] },
            timestamp: Date.now()
          }
        }
        
        // Fall back to raw string
        return {
          name: toolName,
          arguments: { raw: argsString },
          timestamp: Date.now()
        }
      }
    }
    
    return null
  }

  const handleSubmit = async () => {
    if (!question.trim() || isLoading) return

    // Start timer
    const startTime = Date.now()
    setResponseDuration(null)

    setIsLoading(true)
    setIsStreaming(true)
    setStreamingComplete(false)
    setIsProcessingAnswer(true)
    setFinalAnswerReceived(false)
    setAnswer('') // Clear previous answer
    setToolCalls([]) // Clear previous tool calls

    try {
      const selectedOption = currentIndexOptions.find(opt => opt.value === selectedIndex)

      let response
      
      // Use alislam API flow for tafseer category or when index is 'alislam'
      if (selectedCategory === 'tafseer' || selectedOption?.index === 'alislam') {
        console.log('selectedOption', selectedOption)
        response = await fetch(`${API_URL}/api/agent`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            prompt: question.trim(),
            namespace: selectedOption?.namespace || '__default__'
          })
        })
      } else {
        response = await fetch(`${API_URL}/api/chat`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            message: question.trim(),
            index: selectedOption?.index || selectedIndex,
            namespace: selectedOption?.namespace || '__default__',
            displayName: selectedOption?.label || selectedIndex,
            description: selectedOption?.description || '',
            format: selectedOption?.format || '' 
          })
        })
      }

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      // Check if the response is streaming (text/plain) or JSON (error)
      const contentType = response.headers.get('content-type')
      
      if (contentType?.includes('application/json')) {
        // Handle error response
        const data = await response.json()
        console.log(data)
        setAnswer(data.error || 'Sorry, I could not process your request.')
        setStreamingComplete(true)
        setIsProcessingAnswer(false)
        setFinalAnswerReceived(false)
        
        // End timer for error response
        const endTime = Date.now()
        setResponseDuration(endTime - startTime)
      } else {
        // Handle streaming response
        const reader = response.body?.getReader()
        const decoder = new TextDecoder()
        
        if (!reader) {
          throw new Error('Failed to get response reader')
        }

        let accumulatedAnswer = ''
        let accumulatedToolCalls: ToolCall[] = []
        let currentChunk = ''
        let chunkNumber = 0
        
        try {
          while (true) {
            const { done, value } = await reader.read()
                        
            if (done) {
              // End timer when streaming is complete
              const endTime = Date.now()
              setResponseDuration(endTime - startTime)
              
              // Mark streaming as complete and trigger final render
              flushSync(() => {
                setIsStreaming(false)
                setStreamingComplete(true)
                setIsProcessingAnswer(false)
              })
              break
            }
            
            // Decode the chunk and add it to the current chunk buffer
            const chunk = decoder.decode(value, { stream: true })
            
            if (chunk.length > 0) {
              console.log('Received chunk:', JSON.stringify(chunk))
              
              // Check if this chunk contains a tool call
              if (chunk.includes('🔧 **Tool Call**')) {
                console.log('Tool call chunk detected')
                // This chunk contains tool call information
                currentChunk += chunk
                
                // Try to extract complete tool calls
                const toolCallPattern = /🔧 \*\*Tool Call\*\*:\s*(.+?)\n📝 \*\*Arguments\*\*:\s*({.*?})\s*(?=🔧 \*\*Tool Call\*\*|$)/gs;
                let match;
                let foundAny = false;
                while ((match = toolCallPattern.exec(currentChunk)) !== null) {
                  const toolCallText = match[0];
                  const toolCall = parseToolCall(toolCallText);
                  if (toolCall) {
                    console.log('Parsed tool call:', toolCall);
                    accumulatedToolCalls.push(toolCall);
                    flushSync(() => {
                      setToolCalls([...accumulatedToolCalls]);
                    });
                    foundAny = true;
                  }
                }
                // Remove all matched tool calls from the buffer
                if (foundAny) {
                  currentChunk = currentChunk.replace(toolCallPattern, '');
                }
              } else if (chunk.includes('📝 **Final Answer**:')) {
                console.log('Final answer chunk detected')
                // This chunk contains the final answer
                const finalAnswerMatch = chunk.match(/📝 \*\*Final Answer\*\*:\n([\s\S]*)/);
                if (finalAnswerMatch) {
                  const answerContent = finalAnswerMatch[1];
                  console.log('Extracted final answer content:', answerContent);
                  
                  // First answer content received, stop processing state
                  if (isProcessingAnswer) {
                    setIsProcessingAnswer(false)
                  }
                  
                  // Mark that final answer has been received
                  setFinalAnswerReceived(true)
                  
                  accumulatedAnswer += answerContent
                  
                  flushSync(() => {
                    setAnswer(accumulatedAnswer.trim())
                  })
                }
              } else {
                console.log('Regular content chunk')
                // This chunk contains regular answer content
                // Don't stop processing state for regular content - only for final answer
                
                accumulatedAnswer += chunk
                
                flushSync(() => {
                  setAnswer(accumulatedAnswer.trim())
                })
              }
            }
            
            chunkNumber++
            
            // Add a small delay to ensure smooth rendering
            await new Promise(resolve => setTimeout(resolve, 10))
          }
          
          // Process any remaining content in the buffer
          if (currentChunk.trim()) {
            const toolCall = parseToolCall(currentChunk)
            
            if (toolCall) {
              accumulatedToolCalls.push(toolCall)
              setToolCalls([...accumulatedToolCalls])
            } else {
              accumulatedAnswer += currentChunk
              setAnswer(accumulatedAnswer.trim())
            }
          }
          
        } finally {
          reader.releaseLock()
        }
      }
    } catch (error) {
      // End timer for error case
      const endTime = Date.now()
      setResponseDuration(endTime - startTime)
      
      flushSync(() => {
        setAnswer('Sorry, there was an error processing your request. Please try again.')
        setIsStreaming(false)
        setStreamingComplete(true)
        setIsProcessingAnswer(false)
        setFinalAnswerReceived(false)
      })
    } finally {
      flushSync(() => {
        setIsLoading(false)
        if (!streamingComplete) {
          setIsStreaming(false)
          setStreamingComplete(true)
          setIsProcessingAnswer(false)
          setFinalAnswerReceived(false)
        }
      })
    }
  }

  const handleNewQuestion = () => {
    setQuestion('')
    setAnswer('')
    setToolCalls([])
    setStreamingComplete(false)
    setIsProcessingAnswer(false)
    setFinalAnswerReceived(false)
    // Reset timer state
    setResponseDuration(null)
  }

  return (
    <main className="container mx-auto px-4 py-8">
      <div className="max-w-4xl mx-auto space-y-6">
       <WelcomeMessage />
      {!answer && !isLoading &&
        <QuestionTemplates
          setQuestion={setQuestion}
          setSelectedIndex={setSelectedIndex}
          indexOptions={currentIndexOptions}
        />
      }

        <QuestionInput
          question={question}
          setQuestion={setQuestion}
          isLoading={isLoading}
          selectedCategory={selectedCategory}
          setSelectedCategory={handleCategoryChange}
          selectedIndex={selectedIndex}
          setSelectedIndex={setSelectedIndex}
          handleSubmit={handleSubmit}
          indexOptions={currentIndexOptions}
        />

        <ThinkingDisplay 
          toolCalls={toolCalls}
          isVisible={toolCalls.length > 0 || isLoading || isProcessingAnswer}
          isLoading={isLoading || isProcessingAnswer}
          shouldCollapse={finalAnswerReceived}
          selectedCategory={selectedCategory}
          selectedBookName={currentIndexOptions.find(opt => opt.value === selectedIndex)?.label}
        />

        <AnswerDisplay
          answer={answer}
          isLoading={isLoading}
          isStreaming={isStreaming}
          streamingComplete={streamingComplete}
          selectedIndex={selectedIndex}
          indexOptions={currentIndexOptions}
          handleNewQuestion={handleNewQuestion}
          processedAnswer={processedAnswer}
          responseDuration={responseDuration}
        />

      </div>
    </main>
  )
} 