# rag/chunker.py
import re
from typing import List

def chunk_text(text: str, chunk_size: int = 500, overlap: int = 50) -> List[str]:
    """
    Very simple chunker by words. Keeps overlap between chunks.
    chunk_size = approximate number of words per chunk.
    """
    words = re.split(r'\s+', text.strip())
    chunks = []
    i = 0
    n = len(words)
    while i < n:
        chunk = words[i:i + chunk_size]
        chunks.append(" ".join(chunk))
        i += chunk_size - overlap
    if not chunks:
        chunks = [text]
    return chunks
