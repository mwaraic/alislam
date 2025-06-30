import { Container, getContainer } from "@cloudflare/containers";
import { Hono } from "hono";

export class EmbeddingContainer extends Container {
  // Port the container listens on (FastAPI default: 8000)
  defaultPort = 8000;
  // Time before container sleeps due to inactivity
  sleepAfter = "10m";
  // Environment variables passed to the container
  envVars = {
    PORT: "8000",
  };

  // Optional lifecycle hooks
  override onStart() {
    console.log("Embedding container successfully started");
  }

  override onStop() {
    console.log("Embedding container successfully shut down");
  }

  override onError(error: unknown) {
    console.log("Embedding container error:", error);
  }
}

// Create Hono app with proper typing for Cloudflare Workers
const app = new Hono<{
  Bindings: { EMBEDDING_CONTAINER: DurableObjectNamespace<EmbeddingContainer> };
}>();

// Home route with available endpoints
app.get("/", (c) => {
  return c.text(
    "Embedding API is running.\n" +
      "Available endpoints:\n" +
      "GET /embedding - Access the embedding service\n" +
      "GET /api/embedding - Alternative embedding endpoint\n" +
      "GET /docs - API documentation\n" +
      "GET /health - Health check\n" +
      "GET /singleton - Get singleton container instance"
  );
});

// Health check endpoint
app.get("/health", (c) => {
  return c.text("Embedding API is running. Use /embedding endpoint for sparse embeddings.");
});

// Route embedding requests to the container
app.all("/embedding/*", async (c) => {
  const container = getContainer(c.env.EMBEDDING_CONTAINER, "embedding-service");
  return await container.fetch(c.req.raw);
});

// Alternative embedding endpoint (for backwards compatibility)
app.all("/api/embedding/*", async (c) => {
  const container = getContainer(c.env.EMBEDDING_CONTAINER, "embedding-service");
  
  // Normalize the path by removing /api prefix
  const url = new URL(c.req.url);
  const targetPath = url.pathname.replace('/api/embedding', '/embedding');
  const modifiedRequest = new Request(
    `${url.protocol}//${url.host}${targetPath}${url.search}`, {
    method: c.req.method,
    headers: c.req.headers,
    body: c.req.body,
  });
  
  return await container.fetch(modifiedRequest);
});

// Documentation endpoint
app.get("/docs", async (c) => {
  const container = getContainer(c.env.EMBEDDING_CONTAINER, "embedding-service");
  return await container.fetch(c.req.raw);
});

// Get a single container instance (singleton pattern)
app.get("/singleton", async (c) => {
  const container = getContainer(c.env.EMBEDDING_CONTAINER);
  return await container.fetch(c.req.raw);
});

export default app; 