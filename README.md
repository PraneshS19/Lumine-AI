# Lumine AI

Lumine AI is a local, document-aware AI chat application. It combines a React
web interface with a FastAPI service and Ollama-hosted language and embedding
models. Documents are parsed and chunked by the backend, then used as context
for retrieval-augmented chat.

## Features

- Chat with a local Ollama language model.
- Upload PDF, DOC, DOCX, and TXT documents for session-scoped Q&A.
- Summarize text and generate quizzes from uploaded documents.
- Optional in-browser voice transcription using `Xenova/whisper-tiny`.
- Light/dark UI and browser-local chat history.

Image selection is present in the interface, but image understanding is not
implemented in the backend. The current backend stores vectors in memory, so
uploaded-document state is lost when the backend restarts.

## Technology stack

| Area | Technologies |
|---|---|
| Frontend | React 18, TypeScript, Vite 4, Tailwind CSS, Lucide |
| Browser speech recognition | `@xenova/transformers` with `Xenova/whisper-tiny` |
| Backend/API | Python, FastAPI, Uvicorn, `python-multipart` |
| Document processing | PyPDF2, python-docx |
| Local AI runtime | Ollama |
| Default language model | `mistral:7b-instruct` |
| Default embedding model | `nomic-embed-text:latest` |

The backend also contains ChromaDB/RAG helper modules; the active API in
`BACKEND/main.py` currently uses an in-memory vector store instead.

## Prerequisites

- Python 3.11 (the version used for local verification)
- Node.js 18 or newer and npm
- [Ollama](https://ollama.com/) installed and running
- Enough memory/disk space for the Ollama models you choose

## Setup and run

Open two terminals from the project root.

### 1. Configure and start the backend

```powershell
cd BACKEND
py -3.11 -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
Copy-Item .env.example .env
ollama pull mistral:7b-instruct
ollama pull nomic-embed-text:latest
python start_server.py
```

If PowerShell prevents environment activation, run the venv interpreter
directly instead:

```powershell
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe start_server.py
```

The API listens on `http://127.0.0.1:8000`. Check
`http://127.0.0.1:8000/health` to see whether both configured Ollama models
are available.

To select other installed Ollama models, edit `BACKEND/.env`:

```dotenv
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_EMBED_MODEL=nomic-embed-text:latest
OLLAMA_LLM_MODEL=mistral:7b-instruct
```

`OLLAMA_BASE_URL` is used by the RAG helper modules; the current active API
uses the local Ollama URL `http://localhost:11434`.

### 2. Start the frontend

```powershell
cd "FRONT END"
npm ci
Copy-Item .env.example .env
npm run dev
```

Open `http://localhost:5173`. Set `VITE_API_BASE_URL` in `FRONT END/.env` if
the backend is running at a different address. The Whisper model is downloaded
by the browser on first use; voice features require microphone permission.

### Production frontend build

```powershell
cd "FRONT END"
npm ci
npm run build
```

The generated `dist/` directory is a local build artifact and is not committed.

## API endpoints

| Method | Path | Purpose |
|---|---|---|
| GET | `/` | Backend status and configured model information |
| GET | `/health` | Health and Ollama model availability |
| POST | `/upload` | Upload a document (`file`, `session_id`) |
| POST | `/query` | Ask a question (`question`, `session_id`) |
| POST | `/summarize` | Summarize text (`text`, `session_id` JSON) |
| POST | `/generate-quiz` | Generate a quiz (`session_id` JSON) |

Interactive API documentation is available at
`http://127.0.0.1:8000/docs` while the backend is running.

## Evaluation and verification

No published benchmark dataset, human ratings, or model-quality scores are
included in this project. The model names are configurable; quality depends
on the selected models and evaluation data. Do not treat successful startup
or endpoint smoke checks as a general model-quality benchmark.

Run the reproducible local model smoke checks after installing the configured
Ollama models. To reproduce the results below, set the model environment
variables before running the script:

```powershell
cd BACKEND
$env:OLLAMA_EMBED_MODEL = "nomic-embed-text:latest"
$env:OLLAMA_LLM_MODEL = "qwen3.5:4b"
.\.venv\Scripts\python.exe evaluate_models.py
```

This small check verifies that Ollama can generate a known arithmetic answer
and that the embedding model ranks a matching document above an unrelated
one. It is a functional smoke test, not a statistically meaningful accuracy
benchmark.

### Recorded smoke-test results

Run on 2026-11-09 with `nomic-embed-text:latest` and `qwen3.5:4b`:

| Check | Result |
|---|---|
| Retrieval top-1 on the single France/Canada example | PASS; France document ranked first |
| Cosine similarity (matching / unrelated document) | 0.8931 / 0.6665 |
| Generation arithmetic check | PASS; returned `42` |
| Test size | 1 retrieval query and 1 generation prompt |
| Backend document workflow | PASS; TXT upload, embedding creation, and context-backed query returned Paris |

These are functional checks only. They are not representative model-quality,
accuracy, or general RAG benchmark scores. The project defaults (`mistral:7b-instruct`
and `nomic-embed-text:latest`) were not both installed in the evaluation
environment. The local model smoke evaluation explicitly selected the
installed Qwen language model and Nomic embedding model. The backend document
workflow was separately verified with the installed Gemma 3 model and Nomic
embeddings.

## Data and privacy

Uploaded files are written under `BACKEND/uploads/`; do not commit real user
documents or generated databases. The repository ignores uploads, local
Ollama configuration, virtual environments, dependency directories, and build
output. Chat history is stored in the browser's local storage. Do not expose
the development servers publicly without adding appropriate authentication,
rate limiting, and deployment security controls.

## Project layout

```text
BACKEND/
  main.py                 FastAPI API and in-memory RAG flow
  start_server.py         Local Uvicorn launcher
  requirements.txt        Python dependencies
  rag/                    ChromaDB and Ollama helper modules
  utils/                  File parsing helpers
FRONT END/
  src/                    React application and API clients
  package.json            Frontend scripts and dependencies
```

## License

No license is currently specified. Unless a license is added, standard
copyright restrictions apply to reuse and redistribution.
