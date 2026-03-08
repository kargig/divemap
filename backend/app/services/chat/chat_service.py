import logging
import uuid
import json
from datetime import datetime
from typing import List, Optional, Dict, Any, Tuple

from sqlalchemy.orm import Session

from fastapi.concurrency import run_in_threadpool
from app.schemas.chat import (
    ChatMessage, ChatRequest, ChatResponse, IntentType, SearchIntent, ChatIntermediateAction
)
from app.models import ChatSession, ChatMessage as ChatMessageModel, User
from app.services.openai_service import openai_service
from app.services.chat.tools import CHAT_TOOLS
from app.services.chat.executors.discovery import execute_discovery
from app.services.chat.executors.others import execute_other_intents
from app.services.chat.weather_enricher import enrich_results_with_weather
from app.services.chat.context_resolver import resolve_page_context

logger = logging.getLogger(__name__)

class ChatService:
    def __init__(self, db: Session):
        self.db = db

    def _get_system_prompt(self, request: ChatRequest, current_date: str, current_weekday: str, page_context_summary: str) -> str:
        location_info = ""
        if request.user_location:
            location_info = f"\nUser's Current Location: {request.user_location} (lat, lon)"
            
        return f"""
You are the Divemap Assistant, an expert scuba diving guide. 
Your goal is to help users find dive sites, centers, marine life, and perform diving calculations.

Current Date: {current_date} ({current_weekday}){location_info}
Page Context: {page_context_summary}

# Guidelines
1. **Be Agentic**: Use the provided tools to fetch data from the database. 
2. **Multi-step**: If the first search returns no results, try to broaden your search (e.g. larger radius or different keywords) before giving up.
3. **Clarify**: If the user's request is too ambiguous, use `ask_user_for_clarification`.
4. **Scope**: Only handle diving-related queries. For unrelated topics, politely decline.
5. **Defaults**: For physics calculations, always assume a PPO2 of 1.4 unless the user specifies otherwise. Do not ask for clarification on PPO2.
5. **Safety**: Always prioritize safety in diving-related advice.
6. **Links**: When mentioning entities, ALWAYS use Markdown links with EXACTLY the relative `route_path` provided in the tool results: `[Name](/path)`. NEVER invent or prepend domain names (like divemap.com, divemap.ai, etc.).
7. **No Hallucination**: Only link to entities that were actually returned by tools.
"""

    async def process_message(self, request: ChatRequest, current_user: Optional[User] = None) -> ChatResponse:
        """
        Agentic message processing loop using OpenAI Tool Calling.
        """
        # 1. Session Setup
        session_id = request.session_id or str(uuid.uuid4())
        
        def _get_or_create_session():
            session = self.db.query(ChatSession).filter(ChatSession.id == session_id).first()
            if not session:
                session = ChatSession(id=session_id, user_id=current_user.id if current_user else None)
                self.db.add(session)
                self.db.commit()
            return session
            
        await run_in_threadpool(_get_or_create_session)

        # 2. Context Preparation
        current_dt = datetime.now()
        current_date = current_dt.date().isoformat()
        current_weekday = current_dt.strftime('%A')
        page_context_summary = await run_in_threadpool(lambda: resolve_page_context(self.db, request.page_context))
        
        system_prompt = self._get_system_prompt(request, current_date, current_weekday, page_context_summary)
        
        messages = [{"role": "system", "content": system_prompt}]
        for msg in request.history[-10:]:
            messages.append({"role": msg.role.value, "content": msg.content})
        messages.append({"role": "user", "content": request.message})

        # 3. Agent Loop
        MAX_STEPS = 5
        current_step = 0
        intermediate_steps = []
        collected_results = []
        total_usage = {"prompt_tokens": 0, "completion_tokens": 0, "total_tokens": 0, "cached_tokens": 0}
        final_response_text = ""
        last_intent = None

        while current_step < MAX_STEPS:
            current_step += 1
            
            response, usage = await openai_service.get_chat_completion(
                messages=messages,
                tools=CHAT_TOOLS,
                temperature=0.7
            )
            
            # Update usage
            for k, v in usage.items():
                total_usage[k] = total_usage.get(k, 0) + v
            
            # If it's a tool call
            if isinstance(response, list): # tool_calls
                tool_calls = response
                # Add the assistant's tool call to history
                messages.append({
                    "role": "assistant",
                    "tool_calls": [
                        {
                            "id": tc.id,
                            "type": "function",
                            "function": {
                                "name": tc.function.name,
                                "arguments": tc.function.arguments
                            }
                        } for tc in tool_calls
                    ]
                })

                for tool_call in tool_calls:
                    name = tool_call.function.name
                    args = json.loads(tool_call.function.arguments)
                    
                    logger.info(f"Step {current_step}: Executing tool {name} with args {args}")
                    
                    # Execute tool
                    tool_result = []
                    action_type = "search"
                    
                    if name == "search_dive_sites":
                        tool_result = await run_in_threadpool(
                            lambda: execute_discovery(db=self.db, entity_type_filter="dive_site", **args)
                        )
                        last_intent = SearchIntent(intent_type=IntentType.DISCOVERY, **args)
                    elif name == "search_diving_centers":
                        tool_result = await run_in_threadpool(
                            lambda: execute_discovery(db=self.db, entity_type_filter="diving_center", **args)
                        )
                        last_intent = SearchIntent(intent_type=IntentType.DISCOVERY, **args)
                    elif name == "search_marine_life":
                        # Adapt args for execute_other_intents
                        species = args.pop("marine_species", [])
                        tool_result = await run_in_threadpool(
                            lambda: execute_other_intents(
                                db=self.db, 
                                intent_type=IntentType.MARINE_LIFE, 
                                keywords=species, 
                                **args
                            )
                        )
                        last_intent = SearchIntent(intent_type=IntentType.MARINE_LIFE, keywords=species, **args)
                    elif name == "calculate_diving_physics":
                        tool_result = await run_in_threadpool(
                            lambda: execute_other_intents(
                                db=self.db, 
                                intent_type=IntentType.CALCULATOR, 
                                calculator_params=args,
                                **args
                            )
                        )
                        last_intent = SearchIntent(intent_type=IntentType.CALCULATOR, calculator_params=args)
                    elif name == "search_certifications":
                        tool_result = await run_in_threadpool(
                            lambda: execute_other_intents(
                                db=self.db, 
                                intent_type=IntentType.CAREER_PATH, 
                                **args
                            )
                        )
                        last_intent = SearchIntent(intent_type=IntentType.CAREER_PATH, **args)
                    elif name == "get_weather_suitability":
                        # We need to create a dummy result list for weather enricher
                        dummy_results = [{
                            "entity_type": "location",
                            "name": args.get("location", "Requested Location"),
                            "latitude": args["latitude"],
                            "longitude": args["longitude"]
                        }]
                        await run_in_threadpool(
                            lambda: enrich_results_with_weather(
                                db=self.db,
                                results=dummy_results,
                                intent_date=args["date"],
                                intent_time=args.get("time"),
                                intent_lat=args["latitude"],
                                intent_lon=args["longitude"],
                                intent_location=args.get("location")
                            )
                        )
                        tool_result = dummy_results
                        last_intent = SearchIntent(
                            intent_type=IntentType.DISCOVERY, 
                            location=args.get("location"),
                            date=args["date"], 
                            time=args.get("time"), 
                            latitude=args["latitude"], 
                            longitude=args["longitude"]
                        )
                    elif name == "recommend_dive_sites":
                        tool_result = await run_in_threadpool(
                            lambda: execute_other_intents(
                                db=self.db,
                                intent_type=IntentType.PERSONAL_RECOMMENDATION,
                                current_user=current_user,
                                **args
                            )
                        )
                        last_intent = SearchIntent(intent_type=IntentType.PERSONAL_RECOMMENDATION, **args)
                    elif name == "ask_user_for_clarification":
                        final_response_text = args["question"]
                        intermediate_steps.append(ChatIntermediateAction(
                            action_type="refine_intent",
                            tool_name=name,
                            parameters=args,
                            reasoning=f"Step {current_step}: Asking user for clarification: {args['question']}"
                        ))
                        break # Exit the loop early
                    
                    # Deduplicate and collect results for final response
                    for r in tool_result:
                        # Check if already in collected_results
                        if not any(cr.get("id") == r.get("id") and cr.get("entity_type") == r.get("entity_type") for cr in collected_results):
                            collected_results.append(r)
                    
                    # Truncate results for context to avoid bloat
                    context_result = tool_result[:5] # Max 5 results per tool call in context
                    
                    messages.append({
                        "role": "tool",
                        "tool_call_id": tool_call.id,
                        "name": name,
                        "content": json.dumps(context_result)
                    })
                    
                    intermediate_steps.append(ChatIntermediateAction(
                        action_type="tool_call",
                        tool_name=name,
                        parameters=args,
                        tool_result=context_result,
                        reasoning=f"Step {current_step}: Executed {name}"
                    ))
                
                if final_response_text: # From clarification tool
                    break
                continue # Let the LLM process the tool results
            
            else: # Final answer from LLM
                final_response_text = response
                break

        # 4. Final Cleanup & Persistence
        if not final_response_text:
            final_response_text = "I'm sorry, I encountered an issue while processing your request."

        message_id = str(uuid.uuid4())
        
        # Save to DB asynchronously
        def _save_messages():
            user_msg = ChatMessageModel(
                session_id=session_id,
                role="user",
                content=request.message,
                debug_data=last_intent.model_dump() if last_intent else {}
            )
            self.db.add(user_msg)
            self.db.flush()
            
            bot_msg = ChatMessageModel(
                session_id=session_id,
                role="assistant",
                content=final_response_text,
                debug_data={
                    "intent": last_intent.model_dump() if last_intent else {},
                    "sources": collected_results,
                    "message_id": message_id,
                    "intermediate_steps": [s.model_dump() for s in intermediate_steps]
                },
                tokens_input=total_usage["prompt_tokens"],
                tokens_output=total_usage["completion_tokens"],
                tokens_total=total_usage["total_tokens"],
                tokens_cached=total_usage.get("cached_tokens", 0)
            )
            self.db.add(bot_msg)
            self.db.commit()

        await run_in_threadpool(_save_messages)

        return ChatResponse(
            response=final_response_text,
            message_id=message_id,
            session_id=session_id,
            sources=collected_results,
            intent=last_intent,
            intermediate_steps=intermediate_steps
        )
