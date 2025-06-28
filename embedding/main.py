import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List
    
class SparseEmbeddingRequest(BaseModel):
    query: str

class SparseEmbeddingResponse(BaseModel):
    q_indices: List[int]
    q_values: List[float]
    query: str

# Create FastAPI app with lifespan
app = FastAPI(title="Embedding API")

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

from core.alibaba import GTEEmbeddidng

# Initialize the sparse embedding model
model_name_or_path = 'Alibaba-NLP/gte-multilingual-base'
sparse_model = GTEEmbeddidng(model_name_or_path)

@app.post("/embedding", response_model=SparseEmbeddingResponse)
async def get_sparse_embedding(request: SparseEmbeddingRequest):
    """Generate sparse embedding indices and values for a given query"""
    try:
        query = request.query.strip()
        if not query:
            raise ValueError("Query cannot be empty")
        
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
        
        return SparseEmbeddingResponse(
            q_indices=q_indices,
            q_values=q_values,
            query=query
        )
        
    except Exception as e:
        from fastapi import HTTPException
        raise HTTPException(status_code=500, detail=f"Error generating sparse embedding: {str(e)}")