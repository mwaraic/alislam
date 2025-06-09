import ChatInterface from './components/ChatInterface'

function App() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card/50 backdrop-blur supports-[backdrop-filter]:bg-card/50">
        <div className="container mx-auto px-4 py-4">
          <h1 className="text-2xl font-bold text-foreground">Alislam Q&A</h1>
          <p className="text-muted-foreground text-sm">Ask questions about Islam and get answers from our knowledge base</p>
        </div>
      </header>
      
      <main className="container mx-auto px-4 py-6">
        <ChatInterface />
      </main>
    </div>
  )
}

export default App 