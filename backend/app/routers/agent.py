from fastapi import APIRouter, Request, HTTPException
from fastapi.responses import Response
import os
import time
from functools import lru_cache

router = APIRouter()

# Map requested paths to local markdown files
PATH_MAP = {
    "": "llms.txt",
    "/": "llms.txt",
    "dive-sites": "dive-sites.md",
    "diving-centers": "diving-centers.md",
    "dives": "dives.md",
    "dive-routes": "dive-routes.md"
}

@lru_cache(maxsize=10)
def _count_tokens_cached(file_path: str, mtime: float) -> str:
    """
    Reads the file and counts tokens using tiktoken.
    The mtime parameter ensures the cache is invalidated if the file changes.
    Tiktoken is imported lazily to avoid loading large dictionaries into memory 
    for worker processes that never serve agent traffic.
    """
    try:
        import tiktoken
    except ImportError:
        # Fallback heuristic if tiktoken is not installed
        with open(file_path, "r", encoding="utf-8") as f:
            content = f.read()
        return str(len(content) // 4)

    with open(file_path, "r", encoding="utf-8") as f:
        content = f.read()
        
    enc = tiktoken.get_encoding("cl100k_base")
    tokens = len(enc.encode(content, disallowed_special=()))
    return str(tokens)

@router.get("/negotiate/{path:path}")
async def negotiate_markdown(request: Request, path: str):
    """
    Serves markdown files to AI agents based on the requested path.
    Includes exact token counts for context window management.
    """
    # Clean the path
    clean_path = path.strip("/")
    
    # Check if the requested path corresponds to a known top-level markdown resource.
    # If the user asks for /dive-sites/123, we still serve the dive-sites.md catalog.
    mapped_file = "llms.txt" # Default to homepage
    for key, filename in PATH_MAP.items():
        if key and clean_path.startswith(key):
            mapped_file = filename
            break

    # Determine full path
    base_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "llm_content"))
    file_path = os.path.join(base_dir, mapped_file)

    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="Markdown representation not found.")

    # Get file modification time for cache invalidation
    mtime = os.path.getmtime(file_path)
    
    # Get exact token count (cached)
    token_count = _count_tokens_cached(file_path, mtime)

    # Read content
    with open(file_path, "r", encoding="utf-8") as f:
        content = f.read()

    # Build response with required agent headers
    headers = {
        "x-markdown-tokens": token_count,
        "Cache-Control": "public, max-age=300",
        "Vary": "Accept"
    }

    return Response(
        content=content,
        media_type="text/markdown; charset=utf-8",
        headers=headers
    )
