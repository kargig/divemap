import os
import logging
import asyncio
import orjson
from typing import Optional, List, Dict, Union, Type, Tuple
import openai
from pydantic import BaseModel
from tenacity import retry, stop_after_attempt, wait_exponential

logger = logging.getLogger(__name__)

class OpenAIService:
    _instance = None

    PROVIDERS = {
        "openai": {
            "api_key_env": "OPENAI_API_KEY",
            "base_url": None,  # Default OpenAI URL
            "default_model": "gpt-4o-mini",
        },
        "deepseek": {
            "api_key_env": "DEEPSEEK_API_KEY",
            "base_url": "https://api.deepseek.com",
            "default_model": "deepseek-chat",
        }
    }

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(OpenAIService, cls).__new__(cls)
            cls._instance._initialized = False
        return cls._instance

    def __init__(self):
        if self._initialized:
            return

        self.provider_name = os.getenv("LLM_PROVIDER", "openai").lower()
        if self.provider_name not in self.PROVIDERS:
            logger.warning(f"Unknown LLM_PROVIDER '{self.provider_name}', falling back to 'openai'")
            self.provider_name = "openai"

        self.provider_config = self.PROVIDERS[self.provider_name]
        self.api_key = os.getenv(self.provider_config["api_key_env"])

        if not self.api_key or self.api_key == "foobar":
            logger.warning(f"{self.provider_config['api_key_env']} not set or using placeholder. Chat features will fail.")
            self.client = None
        else:
            self.client = openai.OpenAI(
                api_key=self.api_key,
                base_url=self.provider_config["base_url"]
            )

        self._initialized = True

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=2, max=10),
        reraise=True
    )
    async def get_chat_completion(
        self,
        messages: List[Dict],
        model: Optional[str] = None,
        max_tokens: int = 2000,
        temperature: float = 0.7,
        json_schema: Optional[Type[BaseModel]] = None
    ) -> Tuple[Union[str, Dict], Dict[str, int]]:
        """
        Generic wrapper for OpenAI Chat Completions.
        Supports structured output via Pydantic schemas.
        Returns: (content, usage_dict)
        """
        if not self.client:
            raise ValueError(f"OpenAI client ({self.provider_name}) not initialized. Check API key.")

        # Use provider's default model if not specified
        if model is None:
            model = self.provider_config["default_model"]

        try:
            params = {
                "model": model,
                "messages": messages,
                "max_tokens": max_tokens,
                "temperature": temperature,
            }

            usage_dict = {"prompt_tokens": 0, "completion_tokens": 0, "total_tokens": 0}

            if json_schema:
                # DeepSeek might not support beta.chat.completions.parse yet, check provider
                if self.provider_name == "openai":
                     # Use Beta features for structured output if schema is provided
                    # Note: Requires openai>=1.40.0
                    response = self.client.beta.chat.completions.parse(
                        **params,
                        response_format=json_schema
                    )
                    
                    if response.usage:
                        usage_dict = {
                            "prompt_tokens": response.usage.prompt_tokens,
                            "completion_tokens": response.usage.completion_tokens,
                            "total_tokens": response.usage.total_tokens
                        }
                    logger.info(f"[{self.provider_name}] Tokens: {usage_dict}")
                    
                    return response.choices[0].message.parsed, usage_dict
                else:
                     # Fallback for other providers
                     if self.provider_name == "deepseek":
                         params["response_format"] = {"type": "json_object"}
                     
                     response = self.client.chat.completions.create(**params)
                     
                     if response.usage:
                        usage_dict = {
                            "prompt_tokens": response.usage.prompt_tokens,
                            "completion_tokens": response.usage.completion_tokens,
                            "total_tokens": response.usage.total_tokens
                        }
                     logger.info(f"[{self.provider_name}] Tokens: {usage_dict}")
                     
                     content = response.choices[0].message.content
                     
                     if json_schema:
                         import orjson
                         try:
                             data = orjson.loads(content)
                             return json_schema.model_validate(data), usage_dict
                         except Exception as e:
                             logger.error(f"Failed to parse JSON for {model}: {e}")
                             raise
                     return content, usage_dict
            else:
                response = self.client.chat.completions.create(**params)
                
                if response.usage:
                    usage_dict = {
                        "prompt_tokens": response.usage.prompt_tokens,
                        "completion_tokens": response.usage.completion_tokens,
                        "total_tokens": response.usage.total_tokens
                    }
                logger.info(f"[{self.provider_name}] Tokens: {usage_dict}")
                
                return response.choices[0].message.content, usage_dict
        except Exception as e:
            logger.error(f"{self.provider_name} API error: {str(e)}")
            raise

# Global singleton instance
openai_service = OpenAIService()
