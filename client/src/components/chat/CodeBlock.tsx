import React from 'react'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { oneDark } from 'react-syntax-highlighter/dist/cjs/styles/prism'
import { CopyButton } from './CopyButton'

interface CodeBlockProps {
  inline?: boolean
  className?: string
  children: React.ReactNode
}

export function CodeBlock({ inline, className, children }: CodeBlockProps) {
  const codeString = String(children).replace(/\n$/, '')
  const languageMatch = /language-(\w+)/.exec(className || '')
  let language = languageMatch?.[1]
  
  // Extract language from first line if it starts with a language identifier
  let processedCodeString = codeString
  
  // Always check first few lines for language, even if we already have one from className
  if (codeString.includes('\n')) {
    const lines = codeString.split('\n')
    
    // Find the first non-empty line
    let firstNonEmptyLineIndex = -1
    let firstLine = ''
    for (let i = 0; i < Math.min(3, lines.length); i++) { // Check first 3 lines max
      const trimmedLine = lines[i].trim()
      if (trimmedLine) {
        firstNonEmptyLineIndex = i
        firstLine = trimmedLine
        break
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
    ]
    
    // Check if first non-empty line is a language identifier
    let detectedLanguage = null
    let linesToRemove = 0
    
    if (firstNonEmptyLineIndex >= 0 && firstLine) {
      // Pattern 1: Just the language name
      if (knownLanguages.includes(firstLine.toLowerCase())) {
        detectedLanguage = firstLine.toLowerCase()
        linesToRemove = firstNonEmptyLineIndex + 1
      }
      // Pattern 2: Markdown style ```language
      else if (firstLine.match(/^```(\w+)$/)) {
        const match = firstLine.match(/^```(\w+)$/)!
        detectedLanguage = match[1].toLowerCase()
        linesToRemove = firstNonEmptyLineIndex + 1
      }
      // Pattern 3: Comment style # language or // language
      else if (firstLine.match(/^(#|\/\/)\s*(\w+)$/)) {
        const match = firstLine.match(/^(#|\/\/)\s*(\w+)$/)!
        const lang = match[2].toLowerCase()
        if (knownLanguages.includes(lang)) {
          detectedLanguage = lang
          linesToRemove = firstNonEmptyLineIndex + 1
        }
      }
      // Pattern 4: HTML comment style <!-- language -->
      else if (firstLine.match(/^<!--\s*(\w+)\s*-->$/)) {
        const match = firstLine.match(/^<!--\s*(\w+)\s*-->$/)!
        const lang = match[1].toLowerCase()
        if (knownLanguages.includes(lang)) {
          detectedLanguage = lang
          linesToRemove = firstNonEmptyLineIndex + 1
        }
      }
    }
    
    if (detectedLanguage && linesToRemove > 0) {
      language = detectedLanguage
      processedCodeString = lines.slice(linesToRemove).join('\n')
    }
  }

  // Check if this is truly inline code or a single-line code block
  const isReallyInline = inline || (!processedCodeString.includes('\n') && !className && !language)

  if (isReallyInline) {
    return (
      <code className="bg-muted px-1.5 py-0.5 rounded text-sm font-mono break-words">
        {children}
      </code>
    )
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
  )
} 