const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

export const uploadFile = async (file: File, sessionId: string) => {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('session_id', sessionId);

  const response = await fetch(`${API_BASE_URL}/upload`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    throw new Error(`Upload failed: ${response.status} ${response.statusText}`);
  }

  return response.json();
};

export const queryBackend = async (query: string, sessionId: string) => {
  const formData = new FormData();
  formData.append('question', query);
  formData.append('session_id', sessionId);

  const response = await fetch(`${API_BASE_URL}/query`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    throw new Error(`Query failed: ${response.status} ${response.statusText}`);
  }

  return response.json();
};

export const summarizeText = async (text: string, sessionId: string) => {
  const response = await fetch(`${API_BASE_URL}/summarize`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ text, session_id: sessionId }),
  });

  if (!response.ok) {
    throw new Error(`Summarization failed: ${response.status} ${response.statusText}`);
  }

  return response.json();
};

export const generateQuiz = async (sessionId: string) => {
  const response = await fetch(`${API_BASE_URL}/generate-quiz`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ session_id: sessionId }),
  });

  if (!response.ok) {
    throw new Error(`Quiz generation failed: ${response.status} ${response.statusText}`);
  }

  return response.json();
};