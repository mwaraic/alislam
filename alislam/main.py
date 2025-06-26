import asyncio
import os
from fastapi import FastAPI
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, Union
import json

class StreamingChatResponse(BaseModel):
    type: str  # "content", "error", "done"
    data: Union[str, dict]
    
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

if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port)