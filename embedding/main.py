import os
import sys
import logging
import traceback
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List

# Configure logging to see everything
logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout)
    ]
)
logger = logging.getLogger(__name__)

# Log startup immediately
logger.info("=== STARTING EMBEDDING SERVICE ===")
logger.info(f"Python version: {sys.version}")
logger.info(f"Working directory: {os.getcwd()}")
logger.info(f"Environment variables: {dict(os.environ)}")

class SparseEmbeddingRequest(BaseModel):
    query: str

class SparseEmbeddingResponse(BaseModel):
    q_indices: List[int]
    q_values: List[float]
    query: str

# Create FastAPI app
app = FastAPI(title="Embedding API")
logger.info("FastAPI app created")

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
logger.info("CORS middleware added")

# Global variable for model
sparse_model = None
startup_error = None

@app.on_event("startup")
async def startup_event():
    """Initialize model on startup with extensive error handling"""
    global sparse_model, startup_error
    try:
        logger.info("=== STARTING MODEL INITIALIZATION ===")
        
        # Check available memory
        try:
            import psutil
            memory = psutil.virtual_memory()
            logger.info(f"Available memory: {memory.available / (1024**3):.2f} GB")
            logger.info(f"Total memory: {memory.total / (1024**3):.2f} GB")
        except:
            logger.info("Could not check memory usage")
        
        logger.info("Importing GTEEmbedding class...")
        from core.alibaba import GTEEmbeddidng
        logger.info("Successfully imported GTEEmbedding class")
        
        # Use smaller model for testing
        model_name_or_path = 'Alibaba-NLP/gte-multilingual-base'
        logger.info(f"Loading model: {model_name_or_path}")
        
        logger.info("Creating GTEEmbedding instance...")
        sparse_model = GTEEmbeddidng(model_name_or_path)
        logger.info("=== MODEL LOADED SUCCESSFULLY! ===")
        
        # Test the model with a simple query
        logger.info("Testing model with simple query...")
        test_result = sparse_model.encode(["test"], return_sparse=True)
        logger.info(f"Test successful, got {len(test_result['token_weights'][0])} tokens")
        
    except Exception as e:
        error_msg = f"Failed to load model: {str(e)}"
        logger.error(error_msg)
        logger.error(f"Full traceback: {traceback.format_exc()}")
        startup_error = error_msg
        # Don't fail startup completely, allow health checks to work
        sparse_model = None

@app.post("/embedding", response_model=SparseEmbeddingResponse)
async def get_sparse_embedding(request: SparseEmbeddingRequest):
    """Generate sparse embedding indices and values for a given query"""
    global sparse_model, startup_error
    
    logger.info(f"Received embedding request for query: {request.query[:50]}...")
    
    if sparse_model is None:
        error_msg = f"Model not loaded - service unavailable. Startup error: {startup_error}"
        logger.error(error_msg)
        raise HTTPException(status_code=503, detail=error_msg)
    
    try:
        query = request.query.strip()
        if not query:
            raise ValueError("Query cannot be empty")
        
        logger.info(f"Processing query: {query[:50]}...")
        
        # Encode the query and extract sparse token weights
        q_tw = sparse_model.encode([query], return_sparse=True)["token_weights"][0]

        # Merge duplicate token indices by summing their weights
        merged = {}
        for token, weight in q_tw.items():
            token_id = sparse_model.tokenizer.convert_tokens_to_ids(token)
            if token_id in merged:
                merged[token_id] += float(weight)
            else:
                merged[token_id] = float(weight)

        q_indices = list(merged.keys())
        q_values = list(merged.values())
        
        logger.info(f"Generated {len(q_indices)} embedding indices")
        
        return SparseEmbeddingResponse(
            q_indices=q_indices,
            q_values=q_values,
            query=query
        )
        
    except Exception as e:
        error_msg = f"Error generating sparse embedding: {str(e)}"
        logger.error(error_msg)
        logger.error(f"Full traceback: {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=error_msg)

@app.get("/health")
async def health_check():
    """Health check endpoint with detailed status"""
    global sparse_model, startup_error
    
    logger.info("Health check requested")
    
    status = "healthy" if sparse_model is not None else "model_not_loaded"
    response = {
        "status": status, 
        "message": "Embedding API is running",
        "model_loaded": sparse_model is not None,
        "startup_error": startup_error
    }
    
    logger.info(f"Health check response: {response}")
    return response

@app.get("/")
async def root():
    """Root endpoint"""
    logger.info("Root endpoint accessed")
    return {"message": "Embedding API", "health": "/health", "docs": "/docs"}

@app.get("/debug")
async def debug_info():
    """Debug endpoint with system information"""
    logger.info("Debug endpoint accessed")
    
    try:
        import psutil
        memory = psutil.virtual_memory()
        memory_info = {
            "available_gb": memory.available / (1024**3),
            "total_gb": memory.total / (1024**3),
            "percent_used": memory.percent
        }
    except:
        memory_info = "Could not get memory info"
    
    return {
        "python_version": sys.version,
        "working_directory": os.getcwd(),
        "model_loaded": sparse_model is not None,
        "startup_error": startup_error,
        "memory": memory_info,
        "environment_vars": dict(os.environ)
    }

if __name__ == "__main__":
    logger.info("Starting uvicorn server...")
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)