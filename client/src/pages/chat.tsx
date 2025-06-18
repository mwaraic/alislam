import { QuestionInput } from '@/components/chat/QuestionInput'
import { AnswerDisplay } from '@/components/chat/AnswerDisplay'
import { WelcomeMessage } from '@/components/chat/WelcomeMessage'
import { QuestionTemplates } from '@/components/chat/QuestionTemplates'
import { useState, useMemo } from 'react'
import { flushSync } from 'react-dom'
import indexOptions from '@/data/books'

const API_URL = process.env.NODE_ENV === 'production' ? '' : 'http://localhost:8787'

export default function ChatPage() {
  const [question, setQuestion] = useState('')
  const [answer, setAnswer] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isStreaming, setIsStreaming] = useState(false)
  const [streamingComplete, setStreamingComplete] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState('ruhani-khazain')

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

    setIsLoading(true)
    setIsStreaming(true)
    setStreamingComplete(false)
    setAnswer('') // Clear previous answer

    try {
      const selectedOption = indexOptions.find(opt => opt.value === selectedIndex)
      const response = await fetch(`${API_URL}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: question.trim(),
          index: selectedOption?.index || selectedIndex,
          namespace: selectedOption?.namespace || '__default__',
          displayName: selectedOption?.label || selectedIndex,
          format: selectedOption?.format || ''
        })
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      // Check if the response is streaming (text/plain) or JSON (error)
      const contentType = response.headers.get('content-type')
      
      if (contentType?.includes('application/json')) {
        // Handle error response
        const data = await response.json()
        setAnswer(data.error || 'Sorry, I could not process your request.')
        setStreamingComplete(true)
      } else {
        // Handle streaming response
        console.log('Detected streaming response, setting up reader...')
        const reader = response.body?.getReader()
        const decoder = new TextDecoder()
        
        if (!reader) {
          throw new Error('Failed to get response reader')
        }

        let accumulatedAnswer = ''
        let chunkNumber = 0
        console.log('Starting to read stream...')
        
        try {
          while (true) {
            console.log(`Reading chunk ${chunkNumber + 1}...`)
            const { done, value } = await reader.read()
            
            console.log(`Chunk ${chunkNumber + 1} - done:`, done, 'value length:', value?.length)
            
            if (done) {
              console.log('Stream completed after', chunkNumber, 'chunks')
              // Mark streaming as complete and trigger final render
              flushSync(() => {
                setIsStreaming(false)
                setStreamingComplete(true)
              })
              break
            }
            
            // Decode the chunk and add it to the accumulated answer
            const chunk = decoder.decode(value, { stream: true })
            console.log(`Chunk ${chunkNumber + 1} decoded:`, {
              length: chunk.length,
              content: chunk.substring(0, 100) + (chunk.length > 100 ? '...' : ''),
              firstChar: chunk.charCodeAt(0),
              lastChar: chunk.charCodeAt(chunk.length - 1)
            })
            
            if (chunk.length > 0) {
              accumulatedAnswer += chunk
              chunkNumber++
              
              console.log(`Setting answer state with ${accumulatedAnswer.length} total chars`)
              
              // Force immediate render with flushSync
              flushSync(() => {
                setAnswer(accumulatedAnswer)
              })
              
              // Add a longer delay to ensure the render completes
              await new Promise(resolve => setTimeout(resolve, 50))
            }
          }
        } finally {
          console.log('Releasing reader lock')
          reader.releaseLock()
        }
      }
    } catch (error) {
      console.error('Error sending message:', error)
      flushSync(() => {
        setAnswer('Sorry, there was an error processing your request. Please try again.')
        setIsStreaming(false)
        setStreamingComplete(true)
      })
    } finally {
      flushSync(() => {
        setIsLoading(false)
        if (!streamingComplete) {
          setIsStreaming(false)
          setStreamingComplete(true)
        }
      })
    }
  }

  const handleNewQuestion = () => {
    setQuestion('')
    setAnswer('')
    setStreamingComplete(false)
  }

  return (
    <main className="container mx-auto px-4 py-8">
      <div className="max-w-4xl mx-auto space-y-6">
       <WelcomeMessage />
      {!answer && !isLoading &&
        <QuestionTemplates
          setQuestion={setQuestion}
          setSelectedIndex={setSelectedIndex}
          indexOptions={indexOptions}
        />
      }

        <QuestionInput
          question={question}
          setQuestion={setQuestion}
          isLoading={isLoading}
          selectedIndex={selectedIndex}
          setSelectedIndex={setSelectedIndex}
          handleSubmit={handleSubmit}
          indexOptions={indexOptions}
        />

        <AnswerDisplay
          answer={answer}
          isLoading={isLoading}
          isStreaming={isStreaming}
          streamingComplete={streamingComplete}
          selectedIndex={selectedIndex}
          indexOptions={indexOptions}
          handleNewQuestion={handleNewQuestion}
          processedAnswer={processedAnswer}
        />

      </div>
    </main>
  )
} 