import asyncio
import os
from fastapi import FastAPI
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, Union, List
import json

class StreamingChatResponse(BaseModel):
    type: str  # "content", "error", "done"
    data: Union[str, dict]
    
class SparseEmbeddingRequest(BaseModel):
    query: str

class SparseEmbeddingResponse(BaseModel):
    q_indices: List[int]
    q_values: List[float]
    query: str

# Create FastAPI app with lifespan
app = FastAPI(title="Al-Islam API")

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class ChatRequestAlislam(BaseModel):
    prompt: Optional[str] = None

from core.agent import graph
from core.alibaba import GTEEmbeddidng

# Initialize the sparse embedding model
model_name_or_path = 'Alibaba-NLP/gte-multilingual-base'
sparse_model = GTEEmbeddidng(model_name_or_path)

async def process_alislam_query(prompt: str):
    """Process Al-Islam query with streaming response"""
    try:
        if not prompt or prompt.strip() == "":
            prompt = "Please provide a question about Islam or the Quran."
        
        # Prepare the input for the graph
        graph_input = {"messages": [{"role": "user", "content": prompt}]}
        
        # Use astream for streaming responses
        async for chunk in graph.astream(graph_input):
            # Extract the content from the chunk
            if isinstance(chunk, dict):
                content = ""
                
                # Handle agent responses with messages
                if "agent" in chunk and "messages" in chunk["agent"]:
                    messages = chunk["agent"]["messages"]
                    if messages and len(messages) > 0:
                        last_message = messages[-1]
                        # Extract content from AIMessage
                        if hasattr(last_message, 'content'):
                            content = last_message.content
                        elif isinstance(last_message, dict) and 'content' in last_message:
                            content = last_message['content']
                
                # Fallback to other chunk formats
                elif "messages" in chunk and len(chunk["messages"]) > 0:
                    last_message = chunk["messages"][-1]
                    if hasattr(last_message, 'content'):
                        content = last_message.content
                    elif isinstance(last_message, dict) and 'content' in last_message:
                        content = last_message['content']
                elif "content" in chunk:
                    content = chunk["content"]
                
                if content and content.strip():
                    yield StreamingChatResponse(type="content", data=content)
        
        yield StreamingChatResponse(type="done", data="")
                
    except Exception as e:
        error_message = f"Error processing Al-Islam query: {str(e)}"
        yield StreamingChatResponse(type="error", data={"error": error_message})

@app.post("/alislam")
async def chat_alislam(request: ChatRequestAlislam):
    """Al-Islam commentary search endpoint with streaming support"""
    async def generate_stream():
        try:
            async for chunk in process_alislam_query(request.prompt or ""):
                if chunk.type == "content":
                    # Send only the raw content without data prefix
                    yield f"{chunk.data}\n\n"
                elif chunk.type == "error":
                    # For errors, send just the error message
                    error_data = chunk.data
                    if isinstance(error_data, dict) and 'error' in error_data:
                        yield f"Error: {error_data['error']}\n\n"
                    else:
                        yield f"Error: {str(error_data)}\n\n"
        except Exception as e:
            yield f"Error: {str(e)}\n\n"
    
    return StreamingResponse(
        generate_stream(),
        media_type="text/plain",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "Content-Type": "text/plain"
        }
    )

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

if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port)