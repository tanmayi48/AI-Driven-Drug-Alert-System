import os
import unittest
from unittest.mock import patch, Mock
from ai_service.main import chat, ChatInput

class ChatTests(unittest.TestCase):
    @patch('ai_service.main.retrieve', return_value=[])
    @patch.dict(os.environ, {'OPENROUTER_API_KEY':'test-key','OPENROUTER_MODEL':'nvidia/nemotron-3-ultra-550b-a55b:free'})
    @patch('ai_service.main.requests.post')
    def test_general_question_reaches_openrouter_without_evidence(self, post, retrieve):
        response=Mock();response.json.return_value={'choices':[{'message':{'content':'Educational answer'}}]};post.return_value=response
        result=chat(ChatInput(question='What is an interaction?'))
        self.assertEqual(result['answer'],'Educational answer')
        self.assertEqual(post.call_args.args[0],'https://openrouter.ai/api/v1/chat/completions')
        self.assertEqual(post.call_args.kwargs['json']['model'],'nvidia/nemotron-3-ultra-550b-a55b:free')

    @patch('ai_service.main.retrieve', return_value=[])
    @patch.dict(os.environ, {'OPENROUTER_API_KEY':''})
    def test_missing_key_is_actionable(self, retrieve):
        result=chat(ChatInput(question='What are medicines?'))
        self.assertIn('OPENROUTER_API_KEY',result['notice'])
        self.assertNotIn('insufficient-evidence',result['mode'])

    @patch('ai_service.main.retrieve', return_value=[{'text':'Specific evidence','source':'Fixture'}])
    @patch.dict(os.environ, {'OPENROUTER_API_KEY':'test-key'})
    @patch('ai_service.main.requests.post')
    def test_malformed_provider_response_keeps_evidence(self, post, retrieve):
        response=Mock();response.json.return_value={'choices':[]};post.return_value=response
        result=chat(ChatInput(question='Explain this prescription'))
        self.assertIn('Specific evidence',result['answer'])
        self.assertIn('OpenRouter',result['notice'])
