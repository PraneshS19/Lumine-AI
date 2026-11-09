# rag/retriever.py
import os
from typing import List, Dict, Any, Optional
import chromadb
from chromadb.config import Settings
from pathlib import Path

class ChromaRetriever:
    def __init__(self):
        db_dir = os.getenv("CHROMA_DIR", "./chroma")
        Path(db_dir).mkdir(parents=True, exist_ok=True)

        # persistent client
        self.client = chromadb.PersistentClient(path=db_dir, settings=Settings(anonymized_telemetry=False))

        # create or get collection
        self.collection = self.client.get_or_create_collection(
            name="lumine_docs",
            metadata={"hnsw:space": "cosine"}
        )

    def add(self, chunks: List[str], embeddings: List[List[float]], session_id: str):
        ids = [f"{session_id}_{i}" for i in range(len(chunks))]
        metadatas = [{"session_id": session_id, "chunk_index": i} for i in range(len(chunks))]

        # Add
        self.collection.add(
            ids=ids,
            documents=chunks,
            metadatas=metadatas,
            embeddings=embeddings
        )

    def search(self, query_embedding: List[float], session_id: Optional[str] = None, top_k: int = 5):
        where = {"session_id": session_id} if session_id else None
        results = self.collection.query(
            query_embeddings=[query_embedding],
            n_results=top_k,
            where=where
        )
        output = []
        if results and results.get("documents"):
            docs = results["documents"][0]
            metadatas = results.get("metadatas", [[]])[0]
            distances = results.get("distances", [[]])[0] if "distances" in results else [None] * len(docs)
            for i, doc in enumerate(docs):
                output.append({
                    "text": doc,
                    "metadata": metadatas[i] if i < len(metadatas) else {},
                    "distance": distances[i] if i < len(distances) else None
                })
        return output
