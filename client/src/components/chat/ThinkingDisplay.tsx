import { useState, useEffect, useRef } from 'react'
import { ChevronDown, ChevronRight, Loader2 } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

interface ToolCall {
  name: string
  arguments: Record<string, any>
  timestamp?: number
}

interface ThinkingDisplayProps {
  toolCalls: ToolCall[]
  isVisible: boolean
  shouldCollapse?: boolean
  selectedCategory?: string
  thinkingContent?: string
  isProcessing?: boolean
}

export function ThinkingDisplay({ toolCalls, isVisible, shouldCollapse = false, thinkingContent, isProcessing = false }: ThinkingDisplayProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [hasUserInteracted, setHasUserInteracted] = useState(false)
  const [hasAutoExpanded, setHasAutoExpanded] = useState(false)
  const prevToolCallsLengthRef = useRef(0)

  // Handle manual toggle with user interaction tracking
  const handleToggle = () => {
    setIsExpanded(!isExpanded)
    setHasUserInteracted(true)
  }

  // Auto-expand when tool calls are first detected or when thinking content is available
  // But only if user hasn't manually interacted
  useEffect(() => {
    const shouldAutoExpand = 
      !hasUserInteracted && 
      !hasAutoExpanded && 
      ((toolCalls.length > 0 && prevToolCallsLengthRef.current === 0) || 
       (thinkingContent && thinkingContent.length > 50)) // Only auto-expand for substantial content

    if (shouldAutoExpand) {
      setIsExpanded(true)
      setHasAutoExpanded(true)
    }

    prevToolCallsLengthRef.current = toolCalls.length
  }, [toolCalls.length, hasUserInteracted, hasAutoExpanded, thinkingContent])

  // Auto-collapse when answer starts streaming (only if user hasn't manually expanded it)
  useEffect(() => {
    if (shouldCollapse && isExpanded && !hasUserInteracted) {
      setIsExpanded(false)
    }
  }, [shouldCollapse, isExpanded, hasUserInteracted])

  // Reset state when component becomes not visible
  useEffect(() => {
    if (!isVisible) {
      setIsExpanded(false)
      setHasUserInteracted(false)
      setHasAutoExpanded(false)
      prevToolCallsLengthRef.current = 0
    }
  }, [isVisible])

  if (!isVisible) return null

  return (
    <div className="mb-4 border border-border rounded-lg bg-muted/30">
      <button
        onClick={handleToggle}
        className="w-full p-4 flex items-center gap-3 text-left hover:bg-muted/50 transition-colors rounded-lg focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
        aria-expanded={isExpanded}
        aria-controls="thinking-content"
        type="button"
      >
        {isExpanded ? (
          <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0" />
        ) : (
          <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
        )}
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <div className="flex items-center gap-2 text-sm font-medium text-foreground">
            <span>Thinking</span>
            {isProcessing && (
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            )}
          </div>
        </div>
      </button>
      
      {isExpanded && (
        <div id="thinking-content" className="px-4 pb-4 space-y-3">
          {/* Show thinking content for both categories */}
          {thinkingContent && thinkingContent.length > 0 ? (
            <div className="p-3 bg-background/50 rounded-md border border-border/50">
              <div className="text-sm text-muted-foreground leading-relaxed prose prose-sm max-w-none">
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={{
                    p: ({ children }: { children?: React.ReactNode }) => (
                      <p className="mb-2 last:mb-0 break-words leading-relaxed text-muted-foreground">
                        {children}
                      </p>
                    ),
                    ul: ({ children }: { children?: React.ReactNode }) => (
                      <ul className="list-disc list-outside ml-4 space-y-1 mb-2 text-muted-foreground">
                        {children}
                      </ul>
                    ),
                    ol: ({ children }: { children?: React.ReactNode }) => (
                      <ol className="list-decimal list-outside ml-4 space-y-1 mb-2 text-muted-foreground">
                        {children}
                      </ol>
                    ),
                    li: ({ children }: { children?: React.ReactNode }) => (
                      <li className="break-words text-muted-foreground">
                        {children}
                      </li>
                    ),
                    strong: ({ children }: { children?: React.ReactNode }) => (
                      <strong className="font-semibold text-foreground">
                        {children}
                      </strong>
                    ),
                    em: ({ children }: { children?: React.ReactNode }) => (
                      <em className="italic text-muted-foreground">
                        {children}
                      </em>
                    ),
                    code: ({ children }: { children?: React.ReactNode }) => (
                      <code className="bg-muted px-1 py-0.5 rounded text-xs font-mono text-foreground">
                        {children}
                      </code>
                    ),
                    blockquote: ({ children }: { children?: React.ReactNode }) => (
                      <blockquote className="border-l-2 border-border pl-3 italic text-muted-foreground mb-2">
                        {children}
                      </blockquote>
                    ),
                  }}
                >
                  {thinkingContent}
                </ReactMarkdown>
              </div>
            </div>
          ) : null}
        </div>
      )}
    </div>
  )
} 