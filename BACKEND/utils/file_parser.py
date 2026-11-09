# utils/file_parser.py
import os
from typing import Optional
from PyPDF2 import PdfReader
import docx

def parse_file(path: str) -> str:
    """Parse various file types and extract text content."""
    if not os.path.exists(path):
        return f"Error: File not found - {path}"
    
    ext = os.path.splitext(path)[1].lower()
    
    try:
        if ext == ".pdf":
            return parse_pdf(path)
        elif ext in [".docx", ".doc"]:
            return parse_docx(path)
        elif ext == ".txt":
            return parse_txt(path)
        elif ext in [".png", ".jpg", ".jpeg", ".webp", ".gif", ".bmp"]:
            return f"Image file detected: {os.path.basename(path)}"
        else:
            return f"Unsupported file type: {ext}"
    except Exception as e:
        return f"Error parsing file {os.path.basename(path)}: {str(e)}"

def parse_pdf(path: str) -> str:
    """Extract text from PDF files."""
    text = []
    try:
        reader = PdfReader(path)
        for page_num, page in enumerate(reader.pages):
            page_text = page.extract_text() or ""
            text.append(page_text)
            
        if not text or all(not t.strip() for t in text):
            return "No extractable text found in PDF"
            
        return "\n".join(text)
    except Exception as e:
        return f"Error parsing PDF: {str(e)}"

def parse_docx(path: str) -> str:
    """Extract text from DOCX files."""
    try:
        doc = docx.Document(path)
        paragraphs = [p.text for p in doc.paragraphs if p.text.strip()]
        
        if not paragraphs:
            return "No text content found in DOCX document"
            
        return "\n".join(paragraphs)
    except Exception as e:
        return f"Error parsing DOCX: {str(e)}"

def parse_txt(path: str) -> str:
    """Extract text from TXT files."""
    try:
        with open(path, "r", encoding="utf-8", errors="ignore") as f:
            content = f.read().strip()
            
        if not content:
            return "Empty text file"
            
        return content
    except UnicodeDecodeError:
        try:
            # Try with different encoding if UTF-8 fails
            with open(path, "r", encoding="latin-1", errors="ignore") as f:
                return f.read().strip()
        except Exception as e:
            return f"Error reading text file: {str(e)}"
    except Exception as e:
        return f"Error parsing TXT: {str(e)}"