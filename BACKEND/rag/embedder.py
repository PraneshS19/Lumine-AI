# rag/embedder.py
import requests
from typing import List

class OllamaEmbedder:
    def __init__(self, model="nomic-embed-text"):
        self.model = model
        self.base_url = "http://localhost:11434/api"

    def embed_texts(self, texts: List[str]) -> List[List[float]]:
        """Embed multiple texts"""
        embeddings = []
        for text in texts:
            if not text.strip():
                continue
                
            embedding = self._get_embedding(text)
            if embedding:
                embeddings.append(embedding)
        
        return embeddings

    def embed_query(self, query: str) -> List[float]:
        """Embed a single query"""
        return self._get_embedding(query)

    def _get_embedding(self, text: str) -> List[float]:
        """Get embedding for a single text"""
        try:
            response = requests.post(
                f"{self.base_url}/embed",
                json={
                    "model": self.model,
                    "input": text
                },
                timeout=30
            )
            
            if response.status_code == 200:
                result = response.json()
                return result.get("embedding", [])
            else:
                print(f"Embedding error {response.status_code}: {response.text}")
                return None
                
        except Exception as e:
            print(f"Embedding request failed: {str(e)}")
            return None