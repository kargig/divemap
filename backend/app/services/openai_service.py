import os
import logging
import asyncio
from typing import Optional, List, Dict, Union, Type
import openai
from pydantic import BaseModel
from tenacity import retry, stop_after_attempt, wait_exponential

logger = logging.getLogger(__name__)

class OpenAIService:
    _instance = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(OpenAIService, cls).__new__(cls)
            cls._instance._initialized = False
        return cls._instance

    def __init__(self):
        if self._initialized:
            return
        
        self.api_key = os.getenv("OPENAI_API_KEY")
        if not self.api_key or self.api_key == "foobar":
            logger.warning("OPENAI_API_KEY not set or using placeholder. Chat features will fail.")
            self.client = None
        else:
            self.client = openai.OpenAI(api_key=self.api_key)
        
        self._initialized = True

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=2, max=10),
        reraise=True
    )
    async def get_chat_completion(
        self, 
        messages: List[Dict], 
        model: str = "gpt-4o", 
        max_tokens: int = 1000,
        temperature: float = 0.7,
        json_schema: Optional[Type[BaseModel]] = None
    ) -> Union[str, Dict]:
        """
        Generic wrapper for OpenAI Chat Completions.
        Supports structured output via Pydantic schemas.
        """
        if not self.client:
            raise ValueError("OpenAI client not initialized. Check API key.")

        try:
            params = {
                "model": model,
                "messages": messages,
                "max_tokens": max_tokens,
                "temperature": temperature,
            }

            if json_schema:
                # Use Beta features for structured output if schema is provided
                # Note: Requires openai>=1.40.0
                response = self.client.beta.chat.completions.parse(
                    **params,
                    response_format=json_schema
                )
                return response.choices[0].message.parsed
            else:
                response = self.client.chat.completions.create(**params)
                return response.choices[0].message.content

        except Exception as e:
            logger.error(f"OpenAI API error: {str(e)}")
            raise

# Global singleton instance
openai_service = OpenAIService()
