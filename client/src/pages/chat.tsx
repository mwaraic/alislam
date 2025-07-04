import { QuestionInput } from '@/components/chat/QuestionInput'
import { AnswerDisplay } from '@/components/chat/AnswerDisplay'
import { ThinkingDisplay } from '@/components/chat/ThinkingDisplay'
import { WelcomeMessage } from '@/components/chat/WelcomeMessage'
import { QuestionTemplates } from '@/components/chat/QuestionTemplates'
import { useState, useMemo } from 'react'
import { flushSync } from 'react-dom'
import booksOptions from '@/data/books'
import tafseerOptions from '@/data/tafseer'

const API_URL = window.location.hostname === 'localhost' ? 'http://localhost:8787' : ''

interface ToolCall {
  name: string
  arguments: Record<string, any>
  timestamp?: number
}

export default function ChatPage() {
  const [question, setQuestion] = useState('')
  const [answer, setAnswer] = useState('')
  const [thinkingContent, setThinkingContent] = useState('')
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
    setThinkingContent('') // Clear previous thinking content
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
        let accumulatedThinking = ''
        let chunkNumber = 0
        let hasStoppedProcessing = false
        let chunkBuffer = '' // Buffer to accumulate partial chunks
        
        try {
          while (true) {
            const { done, value } = await reader.read()
                        
            if (done) {
              // Process any remaining content in buffer before finishing
              if (chunkBuffer.trim()) {
                const remainingLines = chunkBuffer.split('\n').filter(line => line.trim())
                for (const line of remainingLines) {
                  try {
                    const event = JSON.parse(line)
                    if (event.type === 'answer' && event.content) {
                      accumulatedAnswer += event.content
                    } else if (event.type === 'thinking' && event.content) {
                      accumulatedThinking += event.content
                    }
                  } catch (parseError) {
                    // Ignore malformed JSON at end of stream
                    console.warn('Ignoring malformed JSON at end:', line)
                  }
                }
              }
              
              // Final state updates
              flushSync(() => {
                if (accumulatedAnswer.trim()) {
                  setAnswer(accumulatedAnswer.trim())
                }
                if (accumulatedThinking.trim()) {
                  setThinkingContent(accumulatedThinking)
                }
                setIsStreaming(false)
                setStreamingComplete(true)
                setIsProcessingAnswer(false)
              })
              
              // End timer when streaming is complete
              const endTime = Date.now()
              setResponseDuration(endTime - startTime)
              break
            }
            
            // Decode the chunk and add it to buffer
            const chunk = decoder.decode(value, { stream: true })
            chunkBuffer += chunk
            
            if (chunk.length > 0) {
              console.log('Received chunk:', JSON.stringify(chunk))
              
              // Process complete lines from buffer
              const lines = chunkBuffer.split('\n')
              // Keep the last line in buffer (might be incomplete)
              chunkBuffer = lines.pop() || ''
              
              // Process complete lines
              for (const line of lines) {
                if (!line.trim()) continue
                
                try {
                  const event = JSON.parse(line)
                  
                  if (event.type === 'thinking' && event.content) {
                    accumulatedThinking += event.content
                    flushSync(() => {
                      setThinkingContent(accumulatedThinking)
                    })
                  } else if (event.type === 'answer' && event.content) {
                    // First answer content received, stop processing state immediately
                    if (!hasStoppedProcessing) {
                      hasStoppedProcessing = true
                      flushSync(() => {
                        setIsProcessingAnswer(false)
                      })
                    }
                    
                    accumulatedAnswer += event.content
                    flushSync(() => {
                      setAnswer(accumulatedAnswer.trim())
                    })
                  } else if (event.type === 'error' && event.content) {
                    // Handle error events
                    if (!hasStoppedProcessing) {
                      hasStoppedProcessing = true
                    }
                    flushSync(() => {
                      setAnswer(event.content)
                      setIsProcessingAnswer(false)
                    })
                  }
                } catch (parseError) {
                  // Log but don't display malformed JSON
                  console.warn('Skipping malformed JSON line:', line.substring(0, 100) + '...')
                }
              }
            }
            
            chunkNumber++
            
            // Reduce delay for better mobile performance
            await new Promise(resolve => setTimeout(resolve, 5))
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
    setThinkingContent('')
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
          isVisible={toolCalls.length > 0 || thinkingContent.length > 0}
          shouldCollapse={finalAnswerReceived}
          thinkingContent={thinkingContent}
          isProcessing={isProcessingAnswer}
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