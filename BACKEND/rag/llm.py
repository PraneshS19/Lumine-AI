# rag/llm.py
import os
import requests
from typing import List, Dict, Any

class OllamaLLM:
    def __init__(self):
        self.base_url = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
        self.model = os.getenv("OLLAMA_LLM_MODEL", "llama2")  # Changed to more common model

    def generate(self, question: str, context: str = "", chat_history: List[Dict[str, Any]] = None) -> str:
        """Generate response using Ollama with proper API format"""
        
        # Build the prompt
        prompt = f"""Based on the following context, please answer the question. If the context doesn't contain relevant information, say so.

Context:
{context}

Question: {question}

Answer:"""
        
        try:
            print(f"Sending request to Ollama with model: {self.model}")
            
            response = requests.post(
                f"{self.base_url}/api/generate",
                json={
                    "model": self.model,
                    "prompt": prompt,
                    "stream": False
                },
                timeout=120
            )
            
            response.raise_for_status()
            result = response.json()
            
            # Extract response text from Ollama's response format
            if "response" in result:
                return result["response"].strip()
            else:
                print(f"Unexpected response format: {result}")
                return "I received an unexpected response format from the AI model."
                
        except requests.exceptions.ConnectionError:
            return "Error: Cannot connect to Ollama. Please make sure Ollama is running on localhost:11434."
        except requests.exceptions.Timeout:
            return "Error: Request to AI model timed out. Please try again."
        except Exception as e:
            print(f"LLM generation error: {str(e)}")
            return f"Error generating response: {str(e)}"