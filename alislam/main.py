import asyncio
import os
from fastapi import FastAPI
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import Optional, Union
import json

class StreamingChatResponse(BaseModel):
    type: str  # "content", "error", "done"
    data: Union[str, dict]
    
# Create FastAPI app with lifespan
app = FastAPI(title="Al-Islam API")

class ChatRequestAlislam(BaseModel):
    prompt: Optional[str] = None

from core.agent import graph

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
                # Handle different chunk formats from langgraph
                content = ""
                if "messages" in chunk and len(chunk["messages"]) > 0:
                    last_message = chunk["messages"][-1]
                    if hasattr(last_message, 'content'):
                        content = last_message.content
                    elif isinstance(last_message, dict) and 'content' in last_message:
                        content = last_message['content']
                elif "content" in chunk:
                    content = chunk["content"]
                else:
                    content = str(chunk)
                
                if content:
                    yield StreamingChatResponse(type="content", data=content)
        
        yield StreamingChatResponse(type="done", data="")
                
    except Exception as e:
        error_message = f"Error processing Al-Islam query: {str(e)}"
        yield StreamingChatResponse(type="error", data={"error": error_message})

@app.get("/")
async def root():
    """Root endpoint for health check"""
    return {"message": "Al-Islam API is running successfully", "status": "healthy"}

@app.post("/alislam")
async def chat_alislam(request: ChatRequestAlislam):
    """Al-Islam commentary search endpoint with streaming support"""
    async def generate_stream():
        try:
            async for chunk in process_alislam_query(request.prompt or ""):
                yield f"data: {json.dumps(chunk.dict())}\n\n"
        except Exception as e:
            error_chunk = StreamingChatResponse(
                type="error", 
                data={"error": f"Streaming error: {str(e)}"}
            )
            yield f"data: {json.dumps(error_chunk.dict())}\n\n"
    
    return StreamingResponse(
        generate_stream(),
        media_type="text/plain",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "Content-Type": "text/event-stream"
        }
    )

# Vercel serverless function handler
def handler(request):
    return app

if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port)