# Deploy Al-Islam API to Render

This guide helps you deploy the Al-Islam FastAPI application to [Render](https://render.com).

## Prerequisites

1. A GitHub, GitLab, or Bitbucket repository with your code
2. A Render account (free tier available)
3. Required API keys (see Environment Variables section)

## Deployment Methods

### Method 1: Infrastructure as Code (Recommended)

1. **Push your code** to a Git repository
2. **Connect to Render**:
   - Go to [Render Dashboard](https://dashboard.render.com)
   - Click "New" → "Blueprint"
   - Connect your repository
   - Render will automatically detect the `render.yaml` file

### Method 2: Manual Web Service Creation

1. **Create a Web Service**:

   - Go to [Render Dashboard](https://dashboard.render.com)
   - Click "New" → "Web Service"
   - Connect your repository

2. **Configure the service**:
   | Setting | Value |
   | ----------------- | -------------------------------------------- |
   | **Language** | Python 3 |
   | **Build Command** | `pip install -r requirements.txt` |
   | **Start Command** | `uvicorn main:app --host 0.0.0.0 --port $PORT` |

## Environment Variables

Set these environment variables in your Render service settings:

### Required Variables

- `GOOGLE_API_KEY` - Your Google Generative AI API key for Gemini model
- `PYTHONUNBUFFERED` - Set to `1` (already configured in render.yaml)
- `PYTHONDONTWRITEBYTECODE` - Set to `1` (already configured in render.yaml)

### Optional Variables (if using these services)

- `PINECONE_API_KEY` - Pinecone vector database API key
- `PINECONE_ENVIRONMENT` - Pinecone environment
- `COHERE_API_KEY` - Cohere API key

## Health Check

The application includes a health check endpoint at `/docs` which Render will use to monitor service health.

## Access Your Application

Once deployed, your application will be available at:

- **API Documentation**: `https://your-service-name.onrender.com/docs`
- **Al-Islam Endpoint**: `https://your-service-name.onrender.com/alislam`

## Troubleshooting

### Common Issues

1. **Build Failures**: Ensure all dependencies in `requirements.txt` are correct
2. **Port Issues**: The application automatically uses Render's `$PORT` environment variable
3. **API Key Errors**: Make sure all required environment variables are set in Render dashboard

### Logs

View application logs in the Render dashboard under your service's "Logs" tab.

## Cost Considerations

- **Free Tier**: Available with limitations (sleeps after inactivity)
- **Paid Plans**: For production use with guaranteed uptime

For more details, visit the [Render FastAPI deployment guide](https://render.com/docs/deploy-fastapi).
