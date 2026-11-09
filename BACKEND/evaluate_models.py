import json
import math
import os
import re
from pathlib import Path

import requests
from dotenv import load_dotenv

load_dotenv(Path(__file__).with_name(".env"))

BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434").rstrip("/")
EMBED_MODEL = os.getenv("OLLAMA_EMBED_MODEL", "nomic-embed-text:latest")
LLM_MODEL = os.getenv("OLLAMA_LLM_MODEL", "mistral:7b-instruct")


def embed(text: str) -> list[float]:
    response = requests.post(
        f"{BASE_URL}/api/embeddings",
        json={"model": EMBED_MODEL, "prompt": text},
        timeout=180,
    )
    response.raise_for_status()
    return response.json()["embedding"]


def cosine_similarity(left: list[float], right: list[float]) -> float:
    dot = sum(a * b for a, b in zip(left, right))
    left_norm = math.sqrt(sum(value * value for value in left))
    right_norm = math.sqrt(sum(value * value for value in right))
    if not left_norm or not right_norm:
        raise ValueError("The embedding model returned a zero vector.")
    return dot / (left_norm * right_norm)


def main() -> None:
    documents = [
        "Paris is the capital city of France.",
        "Ottawa is the capital city of Canada.",
    ]
    query = "What is the capital of France?"
    query_embedding = embed(query)
    document_embeddings = [embed(document) for document in documents]
    similarities = [
        cosine_similarity(query_embedding, embedding)
        for embedding in document_embeddings
    ]
    ranked_document = max(range(len(similarities)), key=similarities.__getitem__)
    retrieval_passed = ranked_document == 0

    response = requests.post(
        f"{BASE_URL}/api/generate",
        json={
            "model": LLM_MODEL,
            "prompt": "Answer with only the number: What is 6 times 7?",
            "stream": False,
            "think": False,
            "options": {"temperature": 0, "num_predict": 64},
        },
        timeout=180,
    )
    response.raise_for_status()
    answer = response.json().get("response", "")
    generation_passed = re.search(r"\b42\b", answer) is not None

    result = {
        "embedding_model": EMBED_MODEL,
        "language_model": LLM_MODEL,
        "retrieval_smoke_test": {
            "passed": retrieval_passed,
            "top_ranked_document": documents[ranked_document],
            "similarities": [round(value, 4) for value in similarities],
            "test_cases": 1,
        },
        "generation_smoke_test": {
            "passed": generation_passed,
            "answer": answer.strip(),
            "test_cases": 1,
        },
        "scope": "Functional smoke checks only; not a quality benchmark.",
    }
    print(json.dumps(result, indent=2))
    if not retrieval_passed or not generation_passed:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
