import os
import logging
import asyncio
import orjson
from typing import Optional, List, Dict, Union, Type, Tuple, Any
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
            logger.warning(f"API key not set or using placeholder. Chat features will fail.")
            self.client = None
        else:
            self.client = openai.AsyncOpenAI(
                api_key=self.api_key,
                base_url=self.provider_config["base_url"],
                timeout=60.0
            )

        self._initialized = True

    def _repair_json(self, content: str) -> str:
        """
        Attempts to clean and repair JSON strings from LLM responses.
        Handles markdown blocks and prefix/suffix filler text.
        """
        import re
        # 1. Remove markdown code blocks if present
        markdown_match = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", content, re.DOTALL)
        if markdown_match:
            content = markdown_match.group(1)
        
        # 2. Find the first '{' and last '}'
        start = content.find('{')
        end = content.rfind('}')
        if start != -1 and end != -1:
            content = content[start:end+1]
            
        # 3. Basic cleanup
        content = content.strip()
        return content

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
        json_schema: Optional[Type[BaseModel]] = None,
        tools: Optional[List[Dict]] = None,
        tool_choice: Optional[str] = None
    ) -> Tuple[Union[str, Dict, Any], Dict[str, int]]:
        """
        Generic wrapper for OpenAI Chat Completions.
        Supports structured output via Pydantic schemas and Tool Calling.
        Returns: (content or parsed_object or tool_calls, usage_dict)
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

            if tools:
                params["tools"] = tools
                if tool_choice:
                    params["tool_choice"] = tool_choice

            usage_dict = {"prompt_tokens": 0, "completion_tokens": 0, "total_tokens": 0}

            if json_schema and not tools:
                # Use Beta features for structured output if schema is provided AND no tools
                if self.provider_name == "openai":
                    response = await self.client.beta.chat.completions.parse(
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
                    # Fallback for other providers (DeepSeek, etc.)
                    if self.provider_name == "deepseek":
                        params["response_format"] = {"type": "json_object"}
                    
                    response = await self.client.chat.completions.create(**params)
                    
                    if response.usage:
                        usage_dict = {
                            "prompt_tokens": response.usage.prompt_tokens,
                            "completion_tokens": response.usage.completion_tokens,
                            "total_tokens": response.usage.total_tokens
                        }
                    logger.info(f"[{self.provider_name}] Tokens: {usage_dict}")
                    
                    content = response.choices[0].message.content
                    
                    # Robust JSON parsing
                    repaired_content = self._repair_json(content)
                    try:
                        data = orjson.loads(repaired_content)
                        return json_schema.model_validate(data), usage_dict
                    except Exception as e:
                        logger.error(f"JSON repair/parse failed for {model}. Original content: {content[:100]}...")
                        logger.error(f"Error: {e}")
                        raise ValueError(f"Invalid JSON from LLM: {str(e)}")
            else:
                response = await self.client.chat.completions.create(**params)
                
                if response.usage:
                    usage_dict = {
                        "prompt_tokens": response.usage.prompt_tokens,
                        "completion_tokens": response.usage.completion_tokens,
                        "total_tokens": response.usage.total_tokens
                    }
                logger.info(f"[{self.provider_name}] Tokens: {usage_dict}")
                
                message = response.choices[0].message
                if message.tool_calls:
                    return message.tool_calls, usage_dict
                
                return message.content, usage_dict
        except Exception as e:
            # Only log as error if it's not a value error we expect to retry
            if not isinstance(e, ValueError):
                logger.error(f"{self.provider_name} API error: {str(e)}")
            raise

# Global singleton instance
openai_service = OpenAIService()
