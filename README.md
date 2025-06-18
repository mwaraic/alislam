# Alislam Q&A

A Retrieval-Augmented Generation (RAG) question-and-answer application built with React, Hono, LangChain, Pinecone, and Google's Gemini AI. The app allows users to ask questions and receive streaming answers based on multiple Islamic knowledge bases stored in Pinecone vector database.

## Architecture

- **Frontend**: React with TypeScript, Vite, and Tailwind CSS
- **Backend**: Hono framework with LangChain for RAG implementation
- **AI Model**: Google Gemini 2.5 Flash Lite for chat completions and Gemini Embedding Exp for embeddings
- **Vector Database**: Pinecone for document storage and retrieval
- **Reranking**: Cohere Rerank for improved search relevance
- **Deployment**: Cloudflare Workers for serverless backend and static hosting

## Features

- 🤖 **Streaming Q&A** powered by Gemini AI and RAG with real-time token streaming
- 🔍 **Advanced Retrieval** with Cohere reranking for improved search relevance
- 📚 **Multiple Book Collections** including Ruhani Khazain, Fiqh-ul-Masih, and Fiqh-ul-Ahmadiyya
- 💨 **Real-time responses** with streaming and loading states
- 📱 **Responsive design** with modern UI components
- ⚡ **Fast serverless deployment** on Cloudflare
- 🎨 **Beautiful UI** with Tailwind CSS and proper theming
- 🔗 **Source linking** with automatic new.alislam.org references
- 📋 **Question templates** for common Islamic queries
- 📄 **Rich content rendering** with markdown, tables, and code blocks

## Project Structure

```
alislam/
├── client/                 # React frontend
│   ├── src/
│   │   ├── components/    # React components
│   │   │   └── chat/     # Chat-specific components
│   │   ├── data/         # Configuration data
│   │   ├── lib/          # Utility functions
│   │   ├── pages/        # Pages
│   │   ├── types/        # TypeScript types
│   │   ├── App.tsx       # Main app component
│   │   └── main.tsx      # Entry point
│   ├── package.json
│   └── vite.config.ts
├── server/                 # Hono backend
│   ├── src/
│   │   ├── services/     # Business logic services
│   │   ├── routes/       # API routes
│   │   ├── dev.ts        # Development server
│   │   └── index.ts      # Server entry point
│   ├── build.js          # Build script
│   ├── package.json
│   └── tsconfig.json
├── notebooks/             # Jupyter notebooks for development
├── resources/             # Data files and resources
├── wrangler.toml         # Cloudflare Workers config
├── package.json          # Root package.json with build scripts
└── README.md
```

## Setup Instructions

### Prerequisites

- Node.js 18+ and npm
- Gemini API key from Google AI Studio
- Pinecone account and API key
- Cohere API key for reranking
- Cloudflare account (for deployment)

### Quick Start

1. Clone and navigate to the project:

   ```bash
   cd alislam
   ```

2. Install dependencies (installs both client and server):

   ```bash
   npm install
   cd client && npm install
   cd ../server && npm install
   cd ..
   ```

3. Set up environment variables:

   For local development, create `server/.dev.vars`:

   ```
   GEMINI_API_KEY=your-gemini-api-key
   PINECONE_API_KEY=your-pinecone-api-key
   COHERE_API_KEY=your-cohere-api-key
   ```

   For production, set secrets using wrangler:

   ```bash
   wrangler secret put GEMINI_API_KEY
   wrangler secret put PINECONE_API_KEY
   wrangler secret put COHERE_API_KEY
   ```

4. Start development servers:

   ```bash
   npm run dev
   ```

5. Open your browser and visit `http://localhost:5173`

## Build & Deployment

### Development

```bash
# Start both client and server in development
npm run dev

# Start only client
npm run dev:client

# Start only server
npm run dev:server
```

### Production Build

```bash
# Build both client and server
npm run build

# Deploy to Cloudflare Workers
npm run deploy
```

### Deployment Options

```bash
# Deploy to production
npm run deploy

# Deploy to staging
npm run deploy:staging

# Preview deployment
npm run cf:preview

# Development with Cloudflare Workers
npm run cf:dev
```

## API Endpoints

### POST `/api/chat`

Send a question and receive a streaming RAG-powered answer.

**Request Body:**

```json
{
  "message": "What are the five pillars of Islam?",
  "index": "ruhani-khazain",
  "namespace": "__default__",
  "displayName": "Ruhani Khazain",
  "format": "Ruhani Khazain, Vol. X, Pg. X"
}
```

**Response:**
Streaming text response with real-time token delivery.

### GET `/api/health`

Health check endpoint.

**Response:**

```json
{
  "status": "ok",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "service": "Alislam Q&A API"
}
```

## How It Works

1. **User selects a book collection** and asks a question in the interface
2. **Question is sent** to the Hono backend via API with collection metadata
3. **Advanced retrieval pipeline**:
   - Initial similarity search retrieves 50 relevant documents
   - Cohere reranker improves relevance by reordering results
   - Top 5 most relevant documents are selected for context
4. **Gemini AI generates streaming response** based on the retrieved context
5. **Real-time streaming** delivers tokens as they're generated
6. **Rich formatting** renders the answer with proper Islamic references and links

## Configuration

### Gemini AI Setup

1. Get your API key from [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Add it to your environment variables as `GEMINI_API_KEY`

### Pinecone Setup

1. Create a Pinecone account and index
2. Note your API key, environment, and index name
3. Add them to your environment variables
4. Populate your index with Islamic texts and documents in appropriate namespaces

### Cohere Setup

1. Get your API key from [Cohere](https://cohere.ai/)
2. Add it to your environment variables as `COHERE_API_KEY`

### Environment Variables Check

```bash
# Check deployed secrets
wrangler secret list

# Set production secrets
wrangler secret put GEMINI_API_KEY
wrangler secret put PINECONE_API_KEY
wrangler secret put COHERE_API_KEY
```

### Development URLs

- **Client**: http://localhost:5173
- **Server**: http://localhost:8787

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test with `npm run build` and `npm run dev`
5. Submit a pull request

## License

MIT License - feel free to use this project for your own applications.

## Support

For issues and questions, please create an issue in the repository or contact the development team.
