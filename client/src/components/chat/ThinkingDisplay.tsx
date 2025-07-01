import { useState, useEffect } from 'react'
import { ChevronDown, ChevronRight, Search, BookOpen, Loader2 } from 'lucide-react'

interface ToolCall {
  name: string
  arguments: Record<string, any>
  timestamp?: number
}

interface ThinkingDisplayProps {
  toolCalls: ToolCall[]
  isVisible: boolean
  isLoading?: boolean
  shouldCollapse?: boolean
  selectedCategory?: string
  selectedBookName?: string
}

export function ThinkingDisplay({ toolCalls, isVisible, isLoading = false, shouldCollapse = false, selectedCategory = 'tafseer', selectedBookName }: ThinkingDisplayProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [hasAutoExpanded, setHasAutoExpanded] = useState(false)

  // Auto-expand when tool calls are first detected or when loading for books (only once)
  useEffect(() => {
    if ((toolCalls.length > 0 || (selectedCategory === 'books' && isLoading)) && !hasAutoExpanded) {
      setIsExpanded(true)
      setHasAutoExpanded(true)
    }
  }, [toolCalls.length, selectedCategory, isLoading, hasAutoExpanded])

  // Auto-collapse when answer starts streaming
  useEffect(() => {
    if (shouldCollapse && isExpanded) {
      setIsExpanded(false)
      setHasAutoExpanded(false)
    }
  }, [shouldCollapse, isExpanded])

  // Reset auto-expand flag when not visible
  useEffect(() => {
    if (!isVisible) {
      setHasAutoExpanded(false)
      setIsExpanded(false)
    }
  }, [isVisible])

  if (!isVisible) return null

  const getToolIcon = (toolName: string) => {
    switch (toolName) {
      case 'search_commentary':
        return <Search className="h-4 w-4" />
      case 'find_verse':
        return <BookOpen className="h-4 w-4" />
      default:
        return <Search className="h-4 w-4" />
    }
  }

  const formatToolName = (toolName: string) => {
    switch (toolName) {
      case 'search_commentary':
        return 'Searching Commentary'
      case 'find_verse':
        return 'Finding Verse'
      default:
        return toolName.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
    }
  }

  const formatArguments = (args: Record<string, any>) => {
    return Object.entries(args).map(([key, value]) => {
      if (typeof value === 'string' && value.length > 100) {
        return `${key}: "${value.substring(0, 100)}..."`
      }
      return `${key}: ${JSON.stringify(value)}`
    }).join(', ')
  }

  return (
    <div className="mb-4 border border-border rounded-lg bg-muted/30">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full p-4 flex items-center gap-3 text-left hover:bg-muted/50 transition-colors rounded-lg"
      >
        {isExpanded ? (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        )}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 text-sm font-medium text-foreground">
            {isLoading && toolCalls.length === 0 ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Search className="h-4 w-4" />
            )}
            Thinking
          </div>
          {isLoading && (
            <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded animate-pulse">
              {selectedCategory === 'books' ? 'Searching books...' : 'Processing...'}
            </span>
          )}
        </div>
      </button>
      
      {isExpanded && (
        <div className="px-4 pb-4 space-y-3">
          {toolCalls.length > 0 ? (
            toolCalls.map((toolCall, index) => (
              <div key={index} className="flex items-start gap-3 p-3 bg-background/50 rounded-md border border-border/50">
                <div className="flex-shrink-0 mt-0.5">
                  {getToolIcon(toolCall.name)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-foreground mb-1">
                    {formatToolName(toolCall.name)}
                  </div>
                  <div className="text-xs text-muted-foreground break-all">
                    {formatArguments(toolCall.arguments)}
                  </div>
                </div>
              </div>
            ))
          ) : isLoading && selectedCategory === 'books' ? (
            <div className="flex items-start gap-3 p-3 bg-background/50 rounded-md border border-border/50">
              <div className="flex-shrink-0 mt-0.5">
                <BookOpen className="h-4 w-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-foreground mb-1">
                  {selectedBookName || 'Ahmadiyya Literature'}
                </div>
                <div className="text-xs text-muted-foreground">
                  Looking for relevant information...
                </div>
              </div>
            </div>
          ) : null}
        </div>
      )}
    </div>
  )
} 