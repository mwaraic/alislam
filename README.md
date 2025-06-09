# Alislam Q&A

A Retrieval-Augmented Generation (RAG) question-and-answer application built with React, Hono, LangChain, Pinecone, and Google's Gemini AI. The app allows users to ask single questions and receive answers based on an Islamic knowledge base stored in Pinecone vector database.

## Architecture

- **Frontend**: React with TypeScript, Vite, and Tailwind CSS
- **Backend**: Hono framework with LangChain for RAG implementation
- **AI Model**: Google Gemini Pro for chat completions and embeddings
- **Vector Database**: Pinecone for document storage and retrieval
- **Deployment**: Cloudflare Workers for serverless backend and static hosting

## Features

- 🤖 Single-turn Q&A powered by Gemini AI and RAG
- 🔍 Vector similarity search with Pinecone
- 💨 Real-time responses with loading states
- 📱 Responsive design with modern UI
- ⚡ Fast serverless deployment on Cloudflare
- 🎨 Beautiful UI with Tailwind CSS and proper theming
- 📖 Islamic knowledge base integration

## Project Structure

```
alislam/
├── client/                 # React frontend
│   ├── src/
│   │   ├── components/     # React components
│   │   ├── lib/           # Utility functions
│   │   ├── App.tsx        # Main app component
│   │   └── main.tsx       # Entry point
│   ├── package.json
│   └── vite.config.ts
├── server/                 # Hono backend
│   ├── src/
│   │   ├── routes/        # API routes
│   │   └── index.ts       # Server entry point
│   ├── build.js           # Build script
│   ├── package.json
│   └── tsconfig.json
├── wrangler.toml          # Cloudflare Workers config
├── package.json           # Root package.json with build scripts
└── README.md
```

## Setup Instructions

### Prerequisites

- Node.js 18+ and npm
- Gemini API key from Google AI Studio
- Pinecone account and API key
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
   PINECONE_INDEX=your-pinecone-index
   ```

   For production, update `wrangler.toml`:

   ```toml
   [env.production.vars]
   GEMINI_API_KEY = "your-gemini-api-key"
   PINECONE_API_KEY = "your-pinecone-api-key"
   PINECONE_INDEX = "your-pinecone-index"
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

Send a question and receive a RAG-powered answer.

**Request Body:**

```json
{
  "message": "What are the five pillars of Islam?"
}
```

**Response:**

```json
{
  "message": "The five pillars of Islam are...",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

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

1. **User asks a question** in the simple Q&A interface
2. **Question is sent** to the Hono backend via API
3. **LangChain retriever** searches Pinecone vector database for relevant documents
4. **Gemini AI** generates an answer based on the retrieved context
5. **Answer is displayed** to the user in a clean, readable format

This is a **single-turn system** - each question is independent with no conversation history.

## Configuration

### Gemini AI Setup

1. Get your API key from [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Add it to your environment variables as `GEMINI_API_KEY`

### Pinecone Setup

1. Create a Pinecone account and index
2. Note your API key, environment, and index name
3. Add them to your environment variables
4. Populate your index with Islamic texts and documents

### RAG Configuration

The RAG chain is configured in `server/src/routes/chat.ts`:

- **Model**: `gemini-pro` (can be changed to other Gemini models)
- **Temperature**: 0.7 (controls response creativity)
- **Retrieval Count**: 4 documents (k=4 in retriever)
- **Embedding Model**: `embedding-001`

### Customizing the RAG Chain

Modify the RAG chain in `server/src/routes/chat.ts`:

```typescript
// Customize retrieval
const retriever = vectorStore.asRetriever({
  k: 6, // Retrieve more documents
  searchType: "similarity_score_threshold",
  searchKwargs: { scoreThreshold: 0.8 },
});

// Customize prompt for Islamic context
const prompt = PromptTemplate.fromTemplate(`
You are a knowledgeable Islamic scholar AI assistant. Answer the question based on authentic Islamic sources.

Context from Islamic texts:
{context}

Question: {question}

Answer:`);
```

## User Interface

The interface is designed for simplicity:

- **Question Input**: Large text area for typing questions
- **Submit Button**: Send question to get answer
- **Answer Display**: Clean, readable response area
- **New Question**: Easy way to ask another question

No conversation history is maintained - each question is treated independently.

## Troubleshooting

### Common Issues

1. **CORS Errors**: Update the CORS origins in `server/src/index.ts`
2. **Build Errors**: Run `npm run build` from root directory
3. **Environment Variables**: Ensure all required variables are set in `wrangler.toml`
4. **Empty Responses**: Check if Pinecone index has documents and embeddings

### Environment Variables Check

```bash
# Check deployed secrets
wrangler secret list

# Set production secrets
wrangler secret put GEMINI_API_KEY
wrangler secret put PINECONE_API_KEY
wrangler secret put PINECONE_INDEX
```

### Development URLs

- **Client**: http://localhost:5173
- **Server**: http://localhost:8787
- **Production**: https://alislam-qa.tickrbot.workers.dev

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
