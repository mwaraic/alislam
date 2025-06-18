import React from 'react'
import { Send, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface QuestionInputProps {
  question: string
  setQuestion: (question: string) => void
  isLoading: boolean
  selectedIndex: string
  setSelectedIndex: (index: string) => void
  handleSubmit: () => void
  indexOptions: Array<{ value: string; label: string }>
}

export function QuestionInput({
  question,
  setQuestion,
  isLoading,
  selectedIndex,
  setSelectedIndex,
  handleSubmit,
  indexOptions
}: QuestionInputProps) {
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  return (
    <>
    <div className="p-6 border border-border rounded-lg bg-card/50">

      <div className="flex space-x-3 mb-4">
        <textarea
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="Type your question..."
          className="flex-1 min-h-[80px] max-h-[160px] resize-none rounded-md border border-input bg-background px-4 py-3 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          disabled={isLoading}
        />
        <button
          onClick={handleSubmit}
          disabled={!question.trim() || isLoading}
          className={cn(
            'inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
            'bg-primary text-primary-foreground hover:bg-primary/90',
            'h-[80px] w-[80px] flex-shrink-0'
          )}
        >
          {isLoading ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <Send className="h-5 w-5" />
          )}
        </button>
      </div>

      {/* Index Selector */}
      <div className="flex justify-center mb-4">
        <select
          id="index-selector"
          value={selectedIndex}
          onChange={(e) => setSelectedIndex(e.target.value)}
          disabled={isLoading}
          className="w-full max-w-sm rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {indexOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
    </div>
     <p className="text-sm text-muted-foreground mb-4 text-center">
     Disclaimer: AI can make mistakes. Verify from official sources at <a href="https://alislam.org" target="_blank" rel="noopener noreferrer">alislam.org</a>
   </p>
   </>
  )
} 