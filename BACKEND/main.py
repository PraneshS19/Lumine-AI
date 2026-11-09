import sys
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import os
import uuid
import requests
import json
from typing import Dict, List, Any
import math
from dotenv import load_dotenv

load_dotenv()

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

app = FastAPI(title="Lumine AI - RAG Backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)

UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

EMBEDDING_MODEL = os.getenv("OLLAMA_EMBED_MODEL", "nomic-embed-text:latest")
LLM_MODEL = os.getenv("OLLAMA_LLM_MODEL", "mistral:7b-instruct")
OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434").rstrip("/")

print(f"🎯 Using models - Embedding: {EMBEDDING_MODEL}, LLM: {LLM_MODEL}")

def check_ollama_models():
    try:
        response = requests.get(f"{OLLAMA_BASE_URL}/api/tags", timeout=10)
        if response.status_code == 200:
            models = response.json().get('models', [])
            model_names = [model['name'] for model in models]
            
            embedding_available = EMBEDDING_MODEL in model_names
            llm_available = LLM_MODEL in model_names
            
            print(f"🔍 Model check - Embedding: {embedding_available}, LLM: {llm_available}")
            return {
                "embedding_available": embedding_available,
                "llm_available": llm_available,
                "all_models": model_names
            }
        return {"embedding_available": False, "llm_available": False, "all_models": []}
    except Exception as e:
        print(f"❌ Model check error: {e}")
        return {"embedding_available": False, "llm_available": False, "all_models": []}

def chunk_text(text: str, chunk_size: int = 500) -> list:
    words = text.split()
    chunks = []
    for i in range(0, len(words), chunk_size):
        chunk = " ".join(words[i:i + chunk_size])
        chunks.append(chunk)
    return chunks

def parse_file(file_path: str) -> str:
    ext = os.path.splitext(file_path)[1].lower()
    try:
        if ext == '.txt':
            with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                return f.read()
        elif ext == '.pdf':
            try:
                from PyPDF2 import PdfReader
                reader = PdfReader(file_path)
                text = ""
                for page in reader.pages:
                    page_text = page.extract_text()
                    if page_text:
                        text += page_text + "\n"
                return text.strip()
            except ImportError:
                return "PDF text extraction requires PyPDF2 package"
        elif ext in ['.docx', '.doc']:
            try:
                import docx
                doc = docx.Document(file_path)
                text = "\n".join([paragraph.text for paragraph in doc.paragraphs if paragraph.text])
                return text.strip()
            except ImportError:
                return "DOCX text extraction requires python-docx package"
        else:
            return f"Content from {ext} file"
    except Exception as e:
        return f"Error parsing file: {str(e)}"

def get_embedding(text: str):
    try:
        print(f"🔍 Getting embedding for text length: {len(text)}")
        response = requests.post(
            f"{OLLAMA_BASE_URL}/api/embeddings",
            json={
                "model": EMBEDDING_MODEL,
                "prompt": text
            },
            timeout=30
        )
        
        if response.status_code == 200:
            result = response.json()
            embedding = result.get("embedding", [])
            print(f"🔍 Got embedding length: {len(embedding)}")
            return embedding
        else:
            print(f"❌ Embedding API error: {response.status_code} - {response.text}")
            return None
    except Exception as e:
        print(f"❌ Embedding error: {e}")
        return None

def generate_response(prompt: str) -> str:
    try:
        print(f"🤖 Generating response with model: {LLM_MODEL}")
        
        response = requests.post(
            f"{OLLAMA_BASE_URL}/api/generate",
            json={
                "model": LLM_MODEL,
                "prompt": prompt,
                "stream": False,
                "options": {
                    "temperature": 0.7,
                    "top_p": 0.9
                }
            },
            timeout=120
        )
    except requests.exceptions.ConnectionError as exc:
        raise HTTPException(
            status_code=503,
            detail=f"Cannot connect to Ollama at {OLLAMA_BASE_URL}. Start Ollama and try again.",
        ) from exc
    except requests.exceptions.Timeout as exc:
        raise HTTPException(
            status_code=504,
            detail="The Ollama generation request timed out. Try again.",
        ) from exc

    if response.status_code == 404:
        raise HTTPException(
            status_code=503,
            detail=(
                f"Configured Ollama model '{LLM_MODEL}' is not installed. "
                f"Install it with: ollama pull {LLM_MODEL}"
            ),
        )

    try:
        response.raise_for_status()
    except requests.exceptions.HTTPError as exc:
        print(f"❌ LLM API error: {response.status_code} - {response.text}")
        raise HTTPException(
            status_code=502,
            detail=f"Ollama generation failed with status {response.status_code}.",
        ) from exc

    answer = response.json().get("response", "").strip()
    if not answer:
        raise HTTPException(
            status_code=502,
            detail="Ollama returned an empty response.",
        )
    print(f"🤖 Generated answer length: {len(answer)}")
    return answer

def cosine_similarity(vec1, vec2):
    if not vec1 or not vec2:
        return 0
    
    dot_product = sum(a * b for a, b in zip(vec1, vec2))
    norm1 = math.sqrt(sum(a * a for a in vec1))
    norm2 = math.sqrt(sum(b * b for b in vec2))
    
    if norm1 == 0 or norm2 == 0:
        return 0
    
    return dot_product / (norm1 * norm2)

# Simple in-memory storage
vector_store: Dict[str, Dict] = {}

@app.get("/")
def root():
    model_info = check_ollama_models()
    return {
        "message": "Lumine AI RAG Backend is running! 🚀",
        "models": {
            "embedding": EMBEDDING_MODEL,
            "llm": LLM_MODEL,
            "status": model_info
        },
        "vector_store_size": len(vector_store),
        "status": "healthy"
    }

@app.get("/health")
def health():
    model_info = check_ollama_models()
    return {
        "status": "ok", 
        "models": model_info,
        "message": "Full RAG system ready!"
    }

@app.post("/upload")
async def upload_file(file: UploadFile = File(...), session_id: str = Form(...)):
    try:
        print(f"📁 Uploading: {file.filename} for session: {session_id}")
        
        filename = f"{uuid.uuid4()}_{file.filename}"
        file_path = os.path.join(UPLOAD_DIR, filename)
        
        content = await file.read()
        with open(file_path, "wb") as f:
            f.write(content)
        
        text_content = parse_file(file_path)
        print(f"📄 Extracted {len(text_content)} characters from file")
        
        if not text_content.strip() or text_content.startswith("Error"):
            os.remove(file_path)
            raise HTTPException(status_code=400, detail=f"Could not extract text: {text_content}")
        
        chunks = chunk_text(text_content)
        print(f"🔪 Created {len(chunks)} chunks")
        
        stored_chunks = []
        successful_embeddings = 0
        
        for i, chunk in enumerate(chunks):
            embedding = get_embedding(chunk)
            
            chunk_id = f"{session_id}_{i}"
            vector_store[chunk_id] = {
                "text": chunk,
                "embedding": embedding,
                "session_id": session_id,
                "chunk_index": i,
                "filename": filename
            }
            stored_chunks.append(chunk_id)
            
            if embedding:
                successful_embeddings += 1
        
        print(f"💾 Stored {len(stored_chunks)} chunks, {successful_embeddings} with embeddings")
        
        return {
            "message": "File processed successfully with RAG! 🎉", 
            "chunks": len(stored_chunks),
            "embeddings_created": successful_embeddings,
            "filename": filename,
            "session_id": session_id,
            "content_length": len(text_content)
        }
        
    except Exception as e:
        print(f"❌ Upload error: {str(e)}")
        if 'file_path' in locals() and os.path.exists(file_path):
            os.remove(file_path)
        raise HTTPException(status_code=500, detail=f"Upload failed: {str(e)}")

@app.post("/query")
async def query(question: str = Form(...), session_id: str = Form(...)):
    try:
        print(f"🤔 Query: '{question}' for session: {session_id}")
        
        query_embedding = get_embedding(question)
        print(f"🔍 Query embedding: {len(query_embedding) if query_embedding else 'None'}")
        
        session_chunks = [(chunk_id, data) for chunk_id, data in vector_store.items() if data["session_id"] == session_id]
        print(f"🔍 Found {len(session_chunks)} chunks for session")
        
        if not session_chunks:
            answer = generate_response(f"Question: {question}\n\nAnswer:")
            return {
                "answer": answer,
                "sources": [],
                "session_id": session_id,
                "note": "No documents uploaded for this session"
            }
        
        relevant_chunks = []
        
        for chunk_id, chunk_data in session_chunks:
            if query_embedding and chunk_data["embedding"]:
                similarity = cosine_similarity(query_embedding, chunk_data["embedding"])
                relevant_chunks.append({
                    "text": chunk_data["text"],
                    "similarity": similarity,
                    "metadata": {"chunk_index": chunk_data["chunk_index"]}
                })
            else:
                chunk_text_lower = chunk_data["text"].lower()
                question_lower = question.lower()
                word_matches = sum(1 for word in question_lower.split() if word in chunk_text_lower)
                if word_matches > 0:
                    relevant_chunks.append({
                        "text": chunk_data["text"],
                        "similarity": word_matches / len(question.split()),
                        "metadata": {"chunk_index": chunk_data["chunk_index"]}
                    })
        
        relevant_chunks.sort(key=lambda x: x["similarity"], reverse=True)
        top_results = relevant_chunks[:3]
        
        print(f"🔍 Found {len(top_results)} relevant chunks")
        
        context = "\n\n".join([f"Source {i+1}: {r['text']}" for i, r in enumerate(top_results)]) if top_results else "No specific context found."
        
        prompt = f"""Based on the following context, please answer the question. If the context doesn't contain relevant information, say so.

Context:
{context}

Question: {question}

Please provide a helpful answer:"""
        
        answer = generate_response(prompt)
        
        return {
            "answer": answer,
            "sources": top_results,
            "session_id": session_id,
            "context_used": len(top_results) > 0
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Query error: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Query failed: {str(e)}")

# Tools endpoints
@app.post("/summarize")
async def summarize_text(data: dict):
    try:
        text = data.get("text", "")
        session_id = data.get("session_id", "")
        
        if not text:
            return {"summary": "No text provided for summarization"}
        
        prompt = f"""Please provide a concise summary of the following text:

{text}

Summary:"""
        
        summary = generate_response(prompt)
        
        return {
            "summary": summary,
            "session_id": session_id,
            "original_length": len(text),
            "summary_length": len(summary)
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Summarization error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Summarization failed: {str(e)}")

@app.post("/generate-quiz")
async def generate_quiz(data: dict):
    try:
        session_id = data.get("session_id", "")
        
        session_chunks = [(chunk_id, data) for chunk_id, data in vector_store.items() if data["session_id"] == session_id]
        
        if not session_chunks:
            return {"quiz": "No documents found for this session. Please upload documents first to generate a quiz."}
        
        # Combine all chunks for context
        all_text = " ".join([chunk_data["text"] for _, chunk_data in session_chunks[:5]])  # Use first 5 chunks
        
        prompt = f"""Based on the following content, generate a quiz with 5 multiple-choice questions. 
        For each question, provide 4 options and indicate the correct answer.

Content:
{all_text}

Please generate the quiz in this format:

1. Question 1?
   A) Option A
   B) Option B  
   C) Option C
   D) Option D
   Correct: A

2. Question 2?
   A) Option A
   B) Option B
   C) Option C
   D) Option D
   Correct: B

[Continue for 5 questions]

Quiz:"""
        
        quiz = generate_response(prompt)
        
        return {
            "quiz": quiz,
            "session_id": session_id,
            "questions_generated": 5,
            "source_chunks": len(session_chunks)
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Quiz generation error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Quiz generation failed: {str(e)}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)