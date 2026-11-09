import asyncio
import os
import unittest
from unittest.mock import Mock, patch

import main
from fastapi import HTTPException
from rag.llm import OllamaLLM


class ModelConfigurationTests(unittest.TestCase):
    def test_default_generation_model_is_mistral(self):
        self.assertEqual(main.LLM_MODEL, "mistral:7b-instruct")
        self.assertEqual(OllamaLLM().model, "mistral:7b-instruct")

    def test_rag_helper_respects_model_environment_override(self):
        with patch.dict(os.environ, {"OLLAMA_LLM_MODEL": "custom-test-model"}):
            self.assertEqual(OllamaLLM().model, "custom-test-model")

    @patch.object(main.requests, "post")
    def test_generation_uses_configured_model_and_ollama_url(self, post):
        response = Mock()
        response.status_code = 200
        response.json.return_value = {"response": "A test response"}
        post.return_value = response

        with patch.object(main, "LLM_MODEL", "configured-test-model"):
            self.assertEqual(main.generate_response("test prompt"), "A test response")
        post.assert_called_once()
        args, kwargs = post.call_args
        self.assertEqual(args[0], f"{main.OLLAMA_BASE_URL}/api/generate")
        self.assertEqual(kwargs["json"]["model"], "configured-test-model")

    @patch.object(main.requests, "post")
    def test_missing_model_error_includes_install_command(self, post):
        response = Mock()
        response.status_code = 404
        post.return_value = response

        with self.assertRaises(HTTPException) as raised:
            main.generate_response("test prompt")

        self.assertEqual(raised.exception.status_code, 503)
        self.assertIn("ollama pull mistral:7b-instruct", raised.exception.detail)

    @patch.object(main.requests, "post")
    @patch.object(main, "get_embedding", return_value=None)
    def test_query_preserves_missing_model_service_error(self, _embedding, post):
        response = Mock()
        response.status_code = 404
        post.return_value = response

        with self.assertRaises(HTTPException) as raised:
            asyncio.run(main.query("test question", "test-session"))

        self.assertEqual(raised.exception.status_code, 503)


if __name__ == "__main__":
    unittest.main()
