# Embedding API

A FastAPI service for generating sparse embeddings using the GTE (General Text Embeddings) multilingual model.

## Features

- FastAPI-based REST API
- Sparse embedding generation
- CORS support for web applications
- Health checks
- Dockerized deployment

## Docker Usage

### Using Docker Compose (Recommended)

1. Build and run the service:

```bash
docker-compose up --build
```

2. The API will be available at `http://localhost:8000`

3. View the API documentation at `http://localhost:8000/docs`

### Using Docker directly

1. Build the image:

```bash
docker build -t embedding-api .
```

2. Run the container:

```bash
docker run -p 8000:8000 embedding-api
```

## API Endpoints

### POST /embedding

Generate sparse embedding for a given query.

**Request Body:**

```json
{
  "query": "Your text here"
}
```

**Response:**

```json
{
  "q_indices": [1, 2, 3, ...],
  "q_values": [0.1, 0.2, 0.3, ...],
  "query": "Your text here"
}
```

## Example Usage

```bash
curl -X POST "http://localhost:8000/embedding" \
     -H "Content-Type: application/json" \
     -d '{"query": "Hello world"}'
```

## Environment Variables

- `PYTHONUNBUFFERED=1` - Ensures Python output is not buffered

## Health Check

The service includes a health check endpoint accessible at `/docs` that runs every 30 seconds.

## Model

Uses the `Alibaba-NLP/gte-multilingual-base` model for generating embeddings.
