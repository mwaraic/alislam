# Deploy Embedding Service to Cloudflare Containers

This guide will help you deploy your Python FastAPI embedding service as a container on Cloudflare.

## Prerequisites

1. **Docker**: Make sure Docker is running locally

   ```bash
   docker info
   ```

2. **Wrangler CLI**: Install or update to version 3.45.0 or higher

   ```bash
   npm install -g wrangler@latest
   ```

3. **Cloudflare Account**: Ensure you're logged in
   ```bash
   wrangler login
   ```

## Deployment Steps

1. **Navigate to the embedding directory**:

   ```bash
   cd embedding/
   ```

2. **Install Node.js dependencies** (for the Worker):

   ```bash
   npm install
   ```

3. **Deploy the container**:

   ```bash
   wrangler deploy
   ```

   This will:

   - Build your Docker image using the Dockerfile
   - Push it to Cloudflare's Container Registry
   - Deploy your Worker with container configuration
   - Set up the Durable Object for container management

## First Deployment

⚠️ **Important**: After your first deployment, wait several minutes before the container is ready to receive requests. Unlike Workers, containers take time to provision.

## Check Deployment Status

1. **List containers**:

   ```bash
   wrangler containers list
   ```

2. **List container images**:

   ```bash
   wrangler containers images list
   ```

3. **View logs**:
   ```bash
   wrangler tail
   ```

## API Endpoints

Once deployed, your service will be available at:

- `https://embedding-service.YOUR_ACCOUNT.workers.dev/`
- `https://embedding-service.YOUR_ACCOUNT.workers.dev/embedding` - Main API endpoint
- `https://embedding-service.YOUR_ACCOUNT.workers.dev/health` - Health check
- `https://embedding-service.YOUR_ACCOUNT.workers.dev/docs` - FastAPI documentation

## Usage Example

```bash
curl -X POST "https://embedding-service.YOUR_ACCOUNT.workers.dev/embedding" \
  -H "Content-Type: application/json" \
  -d '{"query": "example text to embed"}'
```

## Configuration Options

### Container Settings (in wrangler.toml):

- `max_instances`: Maximum concurrent containers (default: 5)
- `instance_type`: "dev", "basic", or "standard"
- `sleepAfter`: How long to keep container alive when idle

### Environment Variables:

Add environment variables in the `image_vars` section of wrangler.toml:

```toml
image_vars = {
  PORT = "8000",
  MODEL_NAME = "Alibaba-NLP/gte-multilingual-base"
}
```

## Troubleshooting

1. **Container not starting**: Check Docker is running and image builds locally
2. **Timeout errors**: Increase `sleepAfter` time in wrangler.toml
3. **Build failures**: Ensure all dependencies are in requirements.txt

## Local Development

Test your container locally:

```bash
wrangler dev
```

This runs the Worker locally and connects to your container.
