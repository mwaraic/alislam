import React, { useState, useEffect, useRef } from 'react'
import { Loader2 } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { CodeBlock } from './CodeBlock'
import { LinkRenderer } from './LinkRenderer'
import { CopyButton } from './CopyButton'

interface AnswerDisplayProps {
  answer: string
  isLoading: boolean
  isStreaming: boolean
  streamingComplete: boolean
  selectedIndex: string
  indexOptions: Array<{ value: string; label: string }>
  handleNewQuestion: () => void
  processedAnswer: string
  responseDuration?: number | null
}

// Enhanced function to detect if a text block is primarily RTL
function isTextBlockRTL(text: string) {
  // Remove markdown and formatting
  const cleanText = text
    .replace(/`[^`]*`/g, '') // inline code
    .replace(/!\[[^\]]*\]\([^\)]*\)/g, '') // images
    .replace(/\[[^\]]*\]\([^\)]*\)/g, '') // links
    .replace(/<[^>]+>/g, '') // HTML tags
    .replace(/[*_~#>-]/g, '') // markdown formatting
    .trim();
  
  const rtlMatch = cleanText.match(/[\u0591-\u07FF\uFB1D-\uFDFD\uFE70-\uFEFC]/g) || [];
  const ltrMatch = cleanText.match(/[A-Za-z]/g) || [];
  
  // Return RTL if Arabic characters are present and dominant
  return rtlMatch.length > 0 && rtlMatch.length >= ltrMatch.length;
}

// Component to handle mixed RTL/LTR content
function MixedDirectionText({ children }: { children: React.ReactNode }) {
  if (typeof children === 'string') {
    const isRtl = isTextBlockRTL(children);
    return (
      <span 
        dir={isRtl ? 'rtl' : 'ltr'} 
        className={`mixed-text auto-direction ${isRtl ? 'arabic-text' : ''}`}
        style={{ 
          textAlign: isRtl ? 'right' : 'left',
          display: 'block',
          width: '100%'
        }}
      >
        {children}
      </span>
    );
  }
  return <>{children}</>;
}

// Convert code= parameter to page= parameter in URLs within text
function convertCodeToPageInText(text: string): string {
  return text.replace(/code=/g, 'page=')
}

export function AnswerDisplay({
  answer,
  isLoading,
  isStreaming,
  streamingComplete,
  selectedIndex,
  indexOptions,
  handleNewQuestion,
  processedAnswer,
  responseDuration
}: AnswerDisplayProps) {
  if (!answer && !isLoading) return null

  // Web view state
  const [webViewUrl, setWebViewUrl] = useState<string | null>(null);
  const scrollYRef = useRef<number>(0);
  const handleOpenWebView = (url: string) => {
    scrollYRef.current = window.scrollY;
    setWebViewUrl(url);
  };
  const handleCloseWebView = () => {
    setWebViewUrl(null);
    // Restore scroll position after modal closes
    setTimeout(() => {
      window.scrollTo(0, scrollYRef.current);
    }, 0);
  };

  // Prevent background scroll when modal is open
  useEffect(() => {
    if (webViewUrl) {
      document.body.classList.add('overflow-hidden');
    } else {
      document.body.classList.remove('overflow-hidden');
    }
    return () => {
      document.body.classList.remove('overflow-hidden');
    };
  }, [webViewUrl]);

  // Convert URLs in answer text for copying
  const answerForCopy = convertCodeToPageInText(answer);

  // Format response duration
  const formatDuration = (ms: number) => {
    if (ms < 1000) {
      return `${ms}ms`
    } else {
      return `${(ms / 1000).toFixed(1)}s`
    }
  }

  return (
    <div className="p-6 border border-border rounded-lg bg-card/50 relative">
      {/* WebView Modal */}
      {webViewUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
          onClick={handleCloseWebView}
        >
          <div
            className="bg-white rounded-lg shadow-lg max-w-3xl w-full relative"
            onClick={e => e.stopPropagation()}
          >
            <button
              className="absolute top-2 right-2 text-lg font-bold text-gray-600 hover:text-gray-900"
              onClick={handleCloseWebView}
              aria-label="Close"
            >
              ×
            </button>
            <iframe
              src={webViewUrl}
              title="Book Web View"
              className="w-full h-[80vh] rounded-b-lg border-0"
              allowFullScreen
            />
          </div>
        </div>
      )}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold text-foreground">Answer</h2>
          <span className="text-xs bg-muted text-muted-foreground px-2 py-1 rounded">
            {indexOptions.find(opt => opt.value === selectedIndex)?.label}
          </span>
          {responseDuration && (
            <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">
              {formatDuration(responseDuration)}
            </span>
          )}
        </div>
        {answer && !isLoading && (
          <div className="flex items-center gap-2">
            <CopyButton 
              text={answerForCopy}
              className="text-muted-foreground hover:text-foreground hover:bg-muted"
            />
            <button
              onClick={handleNewQuestion}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Ask another question
            </button>
          </div>
        )}
      </div>
      
      {isLoading && !answer ? (
        <div className="flex items-center space-x-3 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span>Generating response...</span>
        </div>
      ) : isStreaming ? (
        <div className="prose prose-sm max-w-none text-foreground" dir="auto">
          <div className="whitespace-pre-wrap text-sm leading-relaxed font-sans" style={{ wordBreak: 'break-word' }}>
            {answer}
          </div>
        </div>
      ) : streamingComplete ? (
        <div className="prose prose-sm max-w-none text-foreground" dir="auto">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              code: CodeBlock as any,
              a: (props: any) => <LinkRenderer {...props} onOpenWebView={handleOpenWebView} />,
              table: ({ children }: { children?: React.ReactNode }) => (
                <div className="mixed-table">
                  <table className="w-full border-collapse border border-border">
                    {children}
                  </table>
                </div>
              ),
              thead: ({ children }: { children?: React.ReactNode }) => (
                <thead className="bg-muted">
                  {children}
                </thead>
              ),
              tbody: ({ children }: { children?: React.ReactNode }) => (
                <tbody className="divide-y divide-border">
                  {children}
                </tbody>
              ),
              tr: ({ children }: { children?: React.ReactNode }) => (
                <tr className="hover:bg-muted/50">
                  {children}
                </tr>
              ),
              th: ({ children }: { children?: React.ReactNode }) => {
                const isRtl = typeof children === 'string' ? isTextBlockRTL(children) : false;
                return (
                  <th className={`px-4 py-3 text-xs font-semibold text-foreground uppercase tracking-wider ${isRtl ? 'text-right' : 'text-left'}`}>
                    <MixedDirectionText>{children}</MixedDirectionText>
                  </th>
                );
              },
              td: ({ children }: { children?: React.ReactNode }) => (
                <td className="px-4 py-3 text-sm text-foreground">
                  <MixedDirectionText>{children}</MixedDirectionText>
                </td>
              ),
              blockquote: ({ children }: { children?: React.ReactNode }) => {
                const isRtl = typeof children === 'string' ? isTextBlockRTL(children as string) : false;
                return (
                  <blockquote className={`${isRtl ? 'arabic-quote' : 'border-l-4 border-border pl-4'} italic text-muted-foreground my-3`} dir="auto">
                    <MixedDirectionText>{children}</MixedDirectionText>
                  </blockquote>
                );
              },
              ul: ({ children }: { children?: React.ReactNode }) => (
                <ul className="list-disc list-outside ml-6 space-y-1 my-3" dir="auto">
                  {children}
                </ul>
              ),
              ol: ({ children }: { children?: React.ReactNode }) => (
                <ol className="list-decimal list-outside ml-6 space-y-1 my-3" dir="auto">
                  {children}
                </ol>
              ),
              li: ({ children }: { children?: React.ReactNode }) => (
                <li className="break-words">
                  <MixedDirectionText>{children}</MixedDirectionText>
                </li>
              ),
              p: ({ children }: { children?: React.ReactNode }) => (
                <p className="mb-3 last:mb-0 break-words leading-relaxed" dir="auto">
                  <MixedDirectionText>{children}</MixedDirectionText>
                </p>
              ),
              h1: ({ children }: { children?: React.ReactNode }) => (
                <h1 className="text-xl font-bold mb-3 mt-4 first:mt-0" dir="auto">
                  <MixedDirectionText>{children}</MixedDirectionText>
                </h1>
              ),
              h2: ({ children }: { children?: React.ReactNode }) => (
                <h2 className="text-lg font-bold mb-3 mt-4 first:mt-0" dir="auto">
                  <MixedDirectionText>{children}</MixedDirectionText>
                </h2>
              ),
              h3: ({ children }: { children?: React.ReactNode }) => (
                <h3 className="text-base font-bold mb-2 mt-3 first:mt-0" dir="auto">
                  <MixedDirectionText>{children}</MixedDirectionText>
                </h3>
              ),
              hr: () => (
                <hr className="my-4 border-border" />
              ),
            }}
          >
            {processedAnswer}
          </ReactMarkdown>
        </div>
      ) :
        <div className="prose prose-sm max-w-none text-foreground" dir="auto">
          <div className="whitespace-pre-wrap text-sm leading-relaxed">
            <MixedDirectionText>{answer}</MixedDirectionText>
          </div>
        </div>
      }
    </div>
  )
} 