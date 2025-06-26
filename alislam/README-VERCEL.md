# Deploy Al-Islam API to Vercel

This guide helps you deploy the Al-Islam FastAPI application to [Vercel](https://vercel.com) - a modern cloud platform optimized for serverless functions.

## Why Vercel?

- **Free Tier**: Deploy for free with generous limits
- **Serverless**: Automatic scaling with zero infrastructure management
- **Fast Deployments**: Deploy in seconds with global CDN
- **Easy Setup**: Simple configuration with `vercel.json`

## Prerequisites

1. A GitHub, GitLab, or Bitbucket repository with your code
2. A free Vercel account
3. Node.js installed (for Vercel CLI)
4. Required API keys (see Environment Variables section)

## Project Structure

Your project should be structured as follows:

```alislam/
├── main.py              # FastAPI application
├── core/                # Core application modules
│   ├── agent.py
│   ├── search.py
│   └── alibaba.py
├── requirements.txt     # Python dependencies
├── vercel.json         # Vercel configuration
└── .vercelignore       # Files to ignore during deployment
```

## Deployment Methods

### Method 1: Using Vercel Dashboard (Recommended)

1. **Push your code** to a Git repository (GitHub, GitLab, or Bitbucket)

2. **Go to [Vercel Dashboard](https://vercel.com/dashboard)**

   - Sign up/Login with your Git provider
   - Click "Add New..." → "Project"

3. **Import your repository**

   - Find your `alislam` repository
   - Click "Import"

4. **Configure deployment settings**:

   - **Project Name**: `alislam-api` (or your preferred name)
   - **Framework Preset**: Other
   - **Root Directory**: `./` (if alislam is your root) or `./alislam`
   - **Build & Output Settings**: Leave as default

5. **Set Environment Variables** (see section below)

6. **Deploy**: Click "Deploy" and wait for deployment to complete

### Method 2: Using Vercel CLI

1. **Install Vercel CLI**:

   ```bash
   npm i -g vercel
   ```

2. **Login to Vercel**:

   ```bash
   vercel login
   ```

3. **Deploy from project directory**:

   ```bash
   cd alislam/
   vercel
   ```

4. **Follow CLI prompts**:
   - Set up and deploy? → Yes
   - Which scope? → Select your account
   - Link to existing project? → No
   - Project name → `alislam-api` (or preferred name)
   - In which directory is your code located? → `./`

## Environment Variables

### Required Variables

Set these in your Vercel project settings:

- **`GOOGLE_API_KEY`** - Your Google Generative AI API key for Gemini model
  - Get from: [Google AI Studio](https://aistudio.google.com)

### Optional Variables (if using these services)

- **`PINECONE_API_KEY`** - Pinecone vector database API key
- **`PINECONE_ENVIRONMENT`** - Pinecone environment name
- **`COHERE_API_KEY`** - Cohere API key

### How to Set Environment Variables

**Via Vercel Dashboard:**

1. Go to your project dashboard
2. Click "Settings" tab
3. Click "Environment Variables"
4. Add each variable with its value

**Via Vercel CLI:**

```bash
vercel env add GOOGLE_API_KEY
# Enter your API key when prompted
```

## Configuration Files

### vercel.json

```json
{
  "builds": [
    {
      "src": "main.py",
      "use": "@vercel/python"
    }
  ],
  "routes": [
    {
      "src": "/(.*)",
      "dest": "main.py"
    }
  ]
}
```

This configuration:

- Uses Vercel's Python runtime
- Routes all requests to your FastAPI application
- Enables serverless function deployment

## Access Your Application

Once deployed, your application will be available at:

- **API Root**: `https://your-project-name.vercel.app/`
- **API Documentation**: `https://your-project-name.vercel.app/docs`
- **Al-Islam Endpoint**: `https://your-project-name.vercel.app/alislam`

## Local Development

To test locally with Vercel's environment:

```bash
vercel dev
```

This starts a local development server that mimics Vercel's serverless environment.

## Troubleshooting

### Common Issues

1. **Build Failures**

   - Check that all dependencies in `requirements.txt` are correct
   - Ensure Python version compatibility (Vercel supports Python 3.9+)

2. **Import Errors**

   - Make sure all relative imports are correct
   - Check that all required files are included (not in `.vercelignore`)

3. **API Key Errors**

   - Verify all environment variables are set in Vercel dashboard
   - Check variable names match exactly (case-sensitive)

4. **Function Timeout**
   - Vercel free tier has a 10-second timeout limit
   - Consider optimizing long-running operations

### Viewing Logs

1. Go to your Vercel project dashboard
2. Click on "Functions" tab
3. Click on any function to view logs
4. Use Vercel CLI: `vercel logs`

### Performance Optimization

- **Cold Starts**: First request after inactivity may be slower
- **Streaming**: Your streaming endpoints work well with Vercel's edge functions
- **Caching**: Consider adding caching for frequently requested data

## Limitations

### Vercel Free Tier

- 100GB bandwidth per month
- 10-second function execution limit
- 100 deployments per day

### Serverless Considerations

- Functions are stateless (no persistent storage)
- Cold start latency on first request
- Limited to HTTP request/response patterns

## Updating Your Deployment

### Automatic Deployments

- Push to your main branch → automatic deployment
- Create pull requests → preview deployments

### Manual Deployments

```bash
vercel --prod  # Deploy to production
```

## Next Steps

1. **Custom Domain**: Add your own domain in Vercel settings
2. **Analytics**: Enable Vercel Analytics for insights
3. **Monitoring**: Set up monitoring and alerts
4. **Performance**: Optimize for serverless environment

## Useful Links

- [Vercel Python Documentation](https://vercel.com/docs/functions/serverless-functions/runtimes/python)
- [FastAPI on Vercel Guide](https://vercel.com/guides/deploying-fastapi-with-vercel)
- [Vercel Environment Variables](https://vercel.com/docs/projects/environment-variables)

Happy coding! 🚀
