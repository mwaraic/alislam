import React, { useState, useMemo } from 'react'
import { Send, Loader2, Copy, Check, ExternalLink, BookOpen } from 'lucide-react'
import { cn } from '@/lib/utils'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { oneDark } from 'react-syntax-highlighter/dist/cjs/styles/prism'
import { flushSync } from 'react-dom'

const API_URL = process.env.NODE_ENV === 'production' ? '' : 'http://localhost:8787' // Use relative URL in production

// Utility functions
const isGoogleMapsUrl = (url: string): boolean => {
  return /google\.com\/maps|goo\.gl\/maps|maps\.google\.com/i.test(url);
};

const getGoogleMapsEmbedUrl = (url: string): string => {
  try {
    // Extract coordinates
    const coordMatch = url.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
    if (coordMatch) {
      const [, lat, lng] = coordMatch;
      return `https://www.google.com/maps/embed/v1/place?key=AIzaSyAQoQrPy0irLVtpdAuFR_s9V2JB7Xr9Bx0&q=${lat},${lng}`;
    }
    
    // Extract place name
    const placeMatch = url.match(/place\/([^\/]+)/);
    if (placeMatch) {
      const placeName = decodeURIComponent(placeMatch[1].split('@')[0].replace(/\+/g, ' '));
      return `https://www.google.com/maps/embed/v1/place?key=AIzaSyAQoQrPy0irLVtpdAuFR_s9V2JB7Xr9Bx0&q=${encodeURIComponent(placeName)}`;
    }
    
    // Extract search query
    const queryMatch = url.match(/[?&]q=([^&]+)/);
    if (queryMatch) {
      const query = decodeURIComponent(queryMatch[1]);
      return `https://www.google.com/maps/embed/v1/place?key=AIzaSyAQoQrPy0irLVtpdAuFR_s9V2JB7Xr9Bx0&q=${encodeURIComponent(query)}`;
    }
    
    // Extract directions
    const dirMatch = url.match(/dir\/([^\/]+)\/([^\/]+)/);
    if (dirMatch) {
      const [, origin, destination] = dirMatch;
      return `https://www.google.com/maps/embed/v1/directions?key=AIzaSyAQoQrPy0irLVtpdAuFR_s9V2JB7Xr9Bx0&origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}`;
    }
    
    return '';
  } catch (error) {
    return '';
  }
};

const copyToClipboard = async (text: string): Promise<boolean> => {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (error) {
    // Fallback for older browsers
    const textArea = document.createElement('textarea');
    textArea.value = text;
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    const success = document.execCommand('copy');
    document.body.removeChild(textArea);
    return success;
  }
};

// Sub-components for markdown rendering
const CopyButton: React.FC<{ text: string; className?: string }> = ({ 
  text, 
  className = '' 
}) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    const success = await copyToClipboard(text);
    setCopied(success);
    
    if (success) {
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <button
      onClick={handleCopy}
      className={`p-1 rounded-md transition-colors ${className}`}
      title="Copy to clipboard"
    >
      {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
    </button>
  );
};

const CodeBlock: React.FC<{
  inline?: boolean;
  className?: string;
  children: React.ReactNode;
}> = ({ inline, className, children }) => {
  const codeString = String(children).replace(/\n$/, '');
  const languageMatch = /language-(\w+)/.exec(className || '');
  let language = languageMatch?.[1];
  
  // Extract language from first line if it starts with a language identifier
  let processedCodeString = codeString;
  
  // Always check first few lines for language, even if we already have one from className
  if (codeString.includes('\n')) {
    const lines = codeString.split('\n');
    
    // Find the first non-empty line
    let firstNonEmptyLineIndex = -1;
    let firstLine = '';
    for (let i = 0; i < Math.min(3, lines.length); i++) { // Check first 3 lines max
      const trimmedLine = lines[i].trim();
      if (trimmedLine) {
        firstNonEmptyLineIndex = i;
        firstLine = trimmedLine;
        break;
      }
    }
    
    // Common programming languages (case-insensitive)
    const knownLanguages = [
      'javascript', 'js', 'typescript', 'ts', 'python', 'py', 'java', 'cpp', 'c++', 'c',
      'html', 'css', 'scss', 'sass', 'json', 'xml', 'yaml', 'yml', 'bash', 'sh', 'shell',
      'sql', 'php', 'ruby', 'go', 'rust', 'swift', 'kotlin', 'dart', 'r', 'matlab',
      'scala', 'perl', 'lua', 'haskell', 'clojure', 'elixir', 'erlang', 'fsharp', 'f#',
      'csharp', 'c#', 'vb', 'vbnet', 'powershell', 'dockerfile', 'makefile', 'nginx',
      'apache', 'toml', 'ini', 'properties', 'graphql', 'solidity', 'vue', 'svelte',
      'astro', 'jsx', 'tsx', 'markdown', 'md', 'plaintext', 'text'
    ];
    
    // Check if first non-empty line is a language identifier
    let detectedLanguage = null;
    let linesToRemove = 0;
    
    if (firstNonEmptyLineIndex >= 0 && firstLine) {
      // Pattern 1: Just the language name
      if (knownLanguages.includes(firstLine.toLowerCase())) {
        detectedLanguage = firstLine.toLowerCase();
        linesToRemove = firstNonEmptyLineIndex + 1;
      }
      // Pattern 2: Markdown style ```language
      else if (firstLine.match(/^```(\w+)$/)) {
        const match = firstLine.match(/^```(\w+)$/)!;
        detectedLanguage = match[1].toLowerCase();
        linesToRemove = firstNonEmptyLineIndex + 1;
      }
      // Pattern 3: Comment style # language or // language
      else if (firstLine.match(/^(#|\/\/)\s*(\w+)$/)) {
        const match = firstLine.match(/^(#|\/\/)\s*(\w+)$/)!;
        const lang = match[2].toLowerCase();
        if (knownLanguages.includes(lang)) {
          detectedLanguage = lang;
          linesToRemove = firstNonEmptyLineIndex + 1;
        }
      }
      // Pattern 4: HTML comment style <!-- language -->
      else if (firstLine.match(/^<!--\s*(\w+)\s*-->$/)) {
        const match = firstLine.match(/^<!--\s*(\w+)\s*-->$/)!;
        const lang = match[1].toLowerCase();
        if (knownLanguages.includes(lang)) {
          detectedLanguage = lang;
          linesToRemove = firstNonEmptyLineIndex + 1;
        }
      }
    }
    
    if (detectedLanguage && linesToRemove > 0) {
      language = detectedLanguage;
      processedCodeString = lines.slice(linesToRemove).join('\n');
    }
  }

  // Check if this is truly inline code or a single-line code block
  const isReallyInline = inline || (!processedCodeString.includes('\n') && !className && !language);

  if (isReallyInline) {
    return (
      <code className="bg-muted px-1.5 py-0.5 rounded text-sm font-mono break-words">
        {children}
      </code>
    );
  }

  return (
    <div className="relative my-4 rounded-lg bg-zinc-900 border border-border overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2 bg-zinc-800 border-b border-border">
        <span className="text-xs text-zinc-400 font-mono select-none">
          {language || 'code'}
        </span>
        <CopyButton 
          text={processedCodeString}
          className="text-zinc-300 hover:text-white hover:bg-zinc-700"
        />
      </div>
      {language ? (
        <div className="[&>*]:!bg-transparent [&>*]:!m-0 [&_*]:!bg-transparent">
          <SyntaxHighlighter
            style={oneDark}
            language={language}
            PreTag="div"
            customStyle={{
              margin: 0,
              padding: '16px',
              background: 'transparent !important',
              fontSize: '14px'
            }}
            wrapLines={true}
            wrapLongLines={true}
            showLineNumbers={false}
            lineNumberStyle={{ display: 'none' }}
          >
            {processedCodeString}
          </SyntaxHighlighter>
        </div>
      ) : (
        <pre className="p-4 text-sm text-zinc-100 font-mono whitespace-pre-wrap overflow-x-auto select-text">
          {processedCodeString}
        </pre>
      )}
    </div>
  );
};

const LinkRenderer: React.FC<{ href?: string; children: React.ReactNode }> = ({ href, children }) => {
  if (!href) return <span>{children}</span>;

  const isGoogleMaps = isGoogleMapsUrl(href);
  const embedUrl = isGoogleMaps ? getGoogleMapsEmbedUrl(href) : '';

  return (
    <div className="my-2">
      <a 
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1 text-primary hover:underline break-all"
      >
        {children}
        <ExternalLink className="h-3 w-3 flex-shrink-0" />
      </a>
      
      {isGoogleMaps && embedUrl && (
        <div className="mt-3 rounded-lg overflow-hidden border border-border">
          <iframe
            src={embedUrl}
            width="100%"
            height="300"
            style={{ border: 0 }}
            allowFullScreen
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            title="Google Maps"
            className="w-full"
          />
        </div>
      )}
    </div>
  );
};

const TableRenderer: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="my-4 overflow-x-auto rounded-lg border border-border">
    <table className="min-w-full divide-y divide-border">
      {children}
    </table>
  </div>
);

export default function ChatInterface() {
  const [question, setQuestion] = useState('')
  const [answer, setAnswer] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isStreaming, setIsStreaming] = useState(false)
  const [streamingComplete, setStreamingComplete] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState('ruhani-khazain')

  const indexOptions = [
    { value: 'ruhani-khazain', label: 'Ruhani Khazain' },
    { value: 'fiqh', label: 'Fiqh-ul-Masih' },
    { value: 'seerat-ul-mahdi', label: 'Seerat-ul-Mahdi' }
  ]

  const processedAnswer = useMemo(() => {
    if (!answer) return '';
    
    // Clean up markdown formatting
    return answer
      .replace(/```(\w*)\s*/g, '\n\n```$1\n')
      .replace(/\n```\s*/g, '\n```\n\n')
      .replace(/\n{3,}/g, '\n\n')
      .replace(/^\n+/, '');
  }, [answer]);

  const handleSubmit = async () => {
    if (!question.trim() || isLoading) return

    setIsLoading(true)
    setIsStreaming(true)
    setStreamingComplete(false)
    setAnswer('') // Clear previous answer

    try {
      const response = await fetch(`${API_URL}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: question.trim(),
          index: selectedIndex
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

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  const handleNewQuestion = () => {
    setQuestion('')
    setAnswer('')
    setStreamingComplete(false)
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Question Input Section */}
      <div className="p-6 border border-border rounded-lg bg-card/50">
        <h2 className="text-lg font-semibold mb-4 text-foreground">Ask a Question</h2>
        
        {/* Index Selector */}
        <div className="mb-4">
          <label htmlFor="index-selector" className="block text-sm font-medium text-foreground mb-2">
            <BookOpen className="inline h-4 w-4 mr-1" />
            Select Text Collection:
          </label>
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

        <div className="flex space-x-3">
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
      </div>

      {/* Answer Section */}
      {(answer || isLoading) && (
        <div className="p-6 border border-border rounded-lg bg-card/50">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold text-foreground">Answer</h2>
              <span className="text-xs bg-muted text-muted-foreground px-2 py-1 rounded">
                {indexOptions.find(opt => opt.value === selectedIndex)?.label}
              </span>
            </div>
            {answer && !isLoading && (
              <div className="flex items-center gap-2">
                <CopyButton 
                  text={answer}
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
              <span>Searching knowledge base and generating response...</span>
            </div>
          ) : isStreaming ? (
            // Render as plain text during streaming with a typewriter cursor
            <div className="prose prose-sm max-w-none text-foreground">
              <div className="whitespace-pre-wrap text-sm leading-relaxed font-sans" style={{ wordBreak: 'break-word' }}>
                {answer}
              </div>
            </div>
          ) : streamingComplete ? (
            // Render with ReactMarkdown after streaming is complete
            <div className="prose prose-sm max-w-none text-foreground">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  code: CodeBlock as any,
                  a: LinkRenderer as any,
                  table: TableRenderer as any,
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
                  th: ({ children }: { children?: React.ReactNode }) => (
                    <th className="px-4 py-3 text-left text-xs font-semibold text-foreground uppercase tracking-wider">
                      {children}
                    </th>
                  ),
                  td: ({ children }: { children?: React.ReactNode }) => (
                    <td className="px-4 py-3 text-sm text-foreground">
                      {children}
                    </td>
                  ),
                  blockquote: ({ children }: { children?: React.ReactNode }) => (
                    <blockquote className="border-l-4 border-border pl-4 italic text-muted-foreground my-3">
                      {children}
                    </blockquote>
                  ),
                  ul: ({ children }: { children?: React.ReactNode }) => (
                    <ul className="list-disc list-outside ml-6 space-y-1 my-3">
                      {children}
                    </ul>
                  ),
                  ol: ({ children }: { children?: React.ReactNode }) => (
                    <ol className="list-decimal list-outside ml-6 space-y-1 my-3">
                      {children}
                    </ol>
                  ),
                  li: ({ children }: { children?: React.ReactNode }) => (
                    <li className="break-words">
                      {children}
                    </li>
                  ),
                  p: ({ children }: { children?: React.ReactNode }) => (
                    <p className="mb-3 last:mb-0 break-words leading-relaxed">
                      {children}
                    </p>
                  ),
                  h1: ({ children }: { children?: React.ReactNode }) => (
                    <h1 className="text-xl font-bold mb-3 mt-4 first:mt-0">
                      {children}
                    </h1>
                  ),
                  h2: ({ children }: { children?: React.ReactNode }) => (
                    <h2 className="text-lg font-bold mb-3 mt-4 first:mt-0">
                      {children}
                    </h2>
                  ),
                  h3: ({ children }: { children?: React.ReactNode }) => (
                    <h3 className="text-base font-bold mb-2 mt-3 first:mt-0">
                      {children}
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
          ) : (
            // Fallback for any other state
            <div className="prose prose-sm max-w-none text-foreground">
              <div className="whitespace-pre-wrap text-sm leading-relaxed">
                {answer}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Welcome Message - only show when no question has been asked */}
      {!answer && !isLoading && !question && (
        <div className="text-center py-12">
          <div className="max-w-2xl mx-auto">
            <h3 className="text-2xl font-bold text-foreground mb-4">Welcome to Alislam Q&A</h3>
            <p className="text-muted-foreground text-lg leading-relaxed">
              Ask any question and get answers from our Islamic knowledge base. 
              Select from different text collections and our AI will search through the selected texts to provide you with accurate information.
            </p>
            <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div className="p-4 border border-border rounded-lg bg-muted/50">
                <h4 className="font-semibold text-foreground mb-2">Ruhani Khazain</h4>
                <p className="text-muted-foreground text-left">
                  The spiritual treasury containing the divine revelations and writings.
                </p>
                <p className="text-xs text-muted-foreground/80 mt-2 font-medium">
                  Currently available: Vol 3, Vol 5, Vol 7, Vol 18, Vol 22
                </p>
              </div>
              <div className="p-4 border border-border rounded-lg bg-muted/50">
                <h4 className="font-semibold text-foreground mb-2">Fiqh-ul-Masih</h4>
                <p className="text-muted-foreground text-left">
                  Comprehensive jurisprudence and legal guidance for spiritual and practical matters.
                </p>
              </div>
              <div className="p-4 border border-border rounded-lg bg-muted/50">
                <h4 className="font-semibold text-foreground mb-2">Seerat-ul-Mahdi</h4>
                <p className="text-muted-foreground text-left">
                  Biographical accounts and historical records.
                </p>
              </div>
            </div>
            <div className="mt-6 p-4 border border-border rounded-lg bg-muted/50">
              <h4 className="font-semibold text-foreground mb-2">How it works:</h4>
              <ul className="text-muted-foreground space-y-1">
                <li>• Select your preferred text collection from the dropdown</li>
                <li>• Ask your question in natural language</li>
                <li>• AI searches the selected texts for relevant information</li>
                <li>• Get accurate, source-based answers with references</li>
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  )
} 