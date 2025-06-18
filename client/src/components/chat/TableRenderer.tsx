import React from 'react'

interface TableRendererProps {
  children: React.ReactNode
}

export function TableRenderer({ children }: TableRendererProps) {
  return (
    <div className="my-4 overflow-x-auto rounded-lg border border-border">
      <table className="min-w-full divide-y divide-border">
        {children}
      </table>
    </div>
  )
} 