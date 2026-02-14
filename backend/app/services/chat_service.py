import logging
import uuid
from datetime import datetime, date, timezone, timedelta
from typing import List, Optional, Dict, Any, Tuple

from sqlalchemy.orm import Session
from sqlalchemy import or_, and_

from app.services.openai_service import openai_service
from app.schemas.chat import SearchIntent, ChatMessage, ChatRequest, ChatResponse, IntentType
from app.models import DiveSite, ParsedDiveTrip, User, CertificationLevel, DivingCenter, ParsedDive
from app.routers.search import search_dive_sites, ENTITY_ICONS
from app.services.open_meteo_service import fetch_wind_data_batch
from app.services.wind_recommendation_service import calculate_wind_suitability

logger = logging.getLogger(__name__)

class ChatService:
    def __init__(self, db: Session):
        self.db = db

    async def extract_search_intent(self, request: ChatRequest) -> SearchIntent:
        """
        Use OpenAI to convert natural language into a structured SearchIntent.
        """
        current_dt = datetime.now()
        current_date = current_dt.date().isoformat()
        current_weekday = current_dt.strftime('%A')
        
        system_prompt = f"""
You are an intelligent intent extractor for Divemap, a scuba diving discovery platform.
Your job is to parse user queries into structured JSON for database searching.

Current Date: {current_date} ({current_weekday})
User's Current Context: {request.context_entity_type or 'None'} ID: {request.context_entity_id or 'None'}

# Instructions
- **Intent**: "discovery" (search), "context_qa" (page info), "knowledge" (general), "chit_chat".
- **Location**: City/Region/Country. English names.
- **Keywords**: Specific diving terms ("wreck", "sharks"). No noise.
- **Dates**: Convert "tomorrow", "this Sunday" to absolute YYYY-MM-DD.
  - Current Reference Date: {current_date}
  - Tomorrow is: {(current_dt + timedelta(days=1)).date().isoformat()}
  - This Sunday is: {((current_dt + timedelta(days=(6 - current_dt.weekday()) % 7))).date().isoformat()}
- **Difficulty**: "beginner" -> 1, "advanced" -> 2.

# Output Example
{{
  "intent_type": "discovery",
  "keywords": ["wreck"],
  "location": "Athens",
  "date": "2026-02-15",
  "date_range": null,
  "difficulty_level": 2,
  "context_entity_id": null,
  "context_entity_type": null
}}
"""
        messages = [
            {"role": "system", "content": system_prompt}
        ]
        
        # Include a limited history for context
        for msg in request.history[-5:]:
            messages.append({"role": msg.role.value, "content": msg.content})
            
        messages.append({"role": "user", "content": request.message})

        try:
            intent = await openai_service.get_chat_completion(
                messages=messages,
                model="gpt-4o-mini",
                temperature=0,
                json_schema=SearchIntent
            )
            
            # Clean up potentially messy date_range from LLM
            if intent.date_range and (len(intent.date_range) == 0 or all(d is None for d in intent.date_range)):
                intent.date_range = None
                
            return intent
        except Exception as e:
            logger.error(f"Failed to extract intent: {str(e)}")
            return SearchIntent(intent_type=IntentType.DISCOVERY, keywords=[request.message])

    def execute_search(self, intent: SearchIntent, current_user: Optional[User] = None) -> List[Dict]:
        """
        Execute database queries based on the extracted intent.
        """
        results = []
        limit = 10 
        
        logger.info(f"Executing search for intent: {intent}")

        if intent.intent_type == IntentType.DISCOVERY:
            # 1. Search Dive Sites
            search_query = self.db.query(DiveSite)
            
            has_filters = False
            if intent.location:
                has_filters = True
                loc_term = intent.location.split(',')[0].strip()
                loc_term = loc_term.replace('Greece', '').strip()
                
                loc_variants = [loc_term]
                if loc_term.lower() in ["attiki", "athens"]: loc_variants.append("Attica")
                if loc_term.lower() == "attica": loc_variants.append("Attiki")
                
                filters = []
                for v in loc_variants:
                    filters.append(DiveSite.region.ilike(f"%{v}%"))
                    filters.append(DiveSite.country.ilike(f"%{v}%"))
                    filters.append(DiveSite.description.ilike(f"%{v}%"))
                
                search_query = search_query.filter(or_(*filters))
            
            if intent.keywords:
                kw_filters = []
                for kw in intent.keywords:
                    clean_kw = kw.lower().strip()
                    if clean_kw in ['dive', 'sites', 'suitable', 'diving', 'tomorrow', 'today', 'around', 'near', 'dive sites']:
                        continue
                    if intent.location and clean_kw in intent.location.lower():
                        continue
                        
                    kw_filters.append(DiveSite.name.ilike(f"%{kw}%"))
                    kw_filters.append(DiveSite.description.ilike(f"%{kw}%"))
                    kw_filters.append(DiveSite.marine_life.ilike(f"%{kw}%"))
                
                if kw_filters:
                    has_filters = True
                    search_query = search_query.filter(or_(*kw_filters))
            
            if intent.difficulty_level:
                has_filters = True
                search_query = search_query.filter(DiveSite.difficulty_id <= intent.difficulty_level)

            if has_filters:
                sites = search_query.limit(limit).all()
                for site in sites:
                    results.append({
                        "entity_type": "dive_site",
                        "id": site.id,
                        "name": site.name,
                        "description": site.description,
                        "latitude": float(site.latitude) if site.latitude else None,
                        "longitude": float(site.longitude) if site.longitude else None,
                        "shore_direction": float(site.shore_direction) if site.shore_direction else None,
                        "difficulty_id": site.difficulty_id,
                        "route_path": f"/dive-sites/{site.id}"
                    })
            else:
                query_str = " ".join(intent.keywords) if intent.keywords else ""
                if query_str:
                    try:
                        sites = search_dive_sites(query_str, limit, self.db)
                        results.extend([s.model_dump() for s in sites])
                    except Exception as e:
                        logger.error(f"Error searching dive sites fallback: {e}")

            # 2. Search Trips
            date_ok = intent.date or (intent.date_range and len(intent.date_range) >= 2 and intent.date_range[0])
            if date_ok or intent.location:
                try:
                    trips_query = self.db.query(ParsedDiveTrip)
                    
                    if intent.date:
                        try:
                            d = date.fromisoformat(intent.date)
                            trips_query = trips_query.filter(ParsedDiveTrip.trip_date == d)
                        except ValueError: pass
                    elif intent.date_range and len(intent.date_range) >= 2 and intent.date_range[0] and intent.date_range[1]:
                        try:
                            d1 = date.fromisoformat(intent.date_range[0])
                            d2 = date.fromisoformat(intent.date_range[1])
                            trips_query = trips_query.filter(
                                ParsedDiveTrip.trip_date >= d1,
                                ParsedDiveTrip.trip_date <= d2
                            )
                        except ValueError: pass
                    
                    if intent.location:
                        trips_query = trips_query.join(DivingCenter).filter(
                            or_(
                                DivingCenter.city.ilike(f"%{intent.location}%"),
                                DivingCenter.region.ilike(f"%{intent.location}%"),
                                DivingCenter.country.ilike(f"%{intent.location}%")
                            )
                        )
                    
                    trips = trips_query.limit(limit).all()
                    for trip in trips:
                        results.append({
                            "entity_type": "dive_trip",
                            "id": trip.id,
                            "name": trip.trip_description or f"Trip on {trip.trip_date}",
                            "route_path": f"/dive-trips/{trip.id}",
                            "icon_name": ENTITY_ICONS["dive_trip"],
                            "metadata": {"date": str(trip.trip_date)}
                        })
                except Exception as e:
                    logger.error(f"Error searching trips: {e}")

        elif intent.intent_type == IntentType.KNOWLEDGE:
            query_str = " ".join(intent.keywords)
            if query_str:
                certs = self.db.query(CertificationLevel).filter(
                    or_(
                        CertificationLevel.name.ilike(f"%{query_str}%"),
                        CertificationLevel.category.ilike(f"%{query_str}%")
                    )
                ).limit(5).all()
                for cert in certs:
                    results.append({
                        "entity_type": "certification",
                        "id": cert.id,
                        "name": cert.name,
                        "metadata": {
                            "organization": cert.diving_organization.acronym if cert.diving_organization else "Unknown",
                            "max_depth": cert.max_depth,
                            "prerequisites": cert.prerequisites
                        }
                    })

        elif intent.intent_type == IntentType.CONTEXT_QA and intent.context_entity_id:
            if intent.context_entity_type == "dive_site":
                site = self.db.query(DiveSite).filter(DiveSite.id == intent.context_entity_id).first()
                if site:
                    results.append({
                        "entity_type": "dive_site",
                        "id": site.id,
                        "name": site.name,
                        "description": site.description,
                        "max_depth": float(site.max_depth) if site.max_depth else None,
                        "marine_life": site.marine_life,
                        "safety_info": site.safety_information
                    })
            elif intent.context_entity_type == "diving_center":
                center = self.db.query(DivingCenter).filter(DivingCenter.id == intent.context_entity_id).first()
                if center:
                    results.append({
                        "entity_type": "diving_center",
                        "id": center.id,
                        "name": center.name,
                        "description": center.description,
                        "address": center.address,
                        "website": center.website
                    })

        return results

    def _check_site_difficulty(self, site_id: int, max_level: int) -> bool:
        site = self.db.query(DiveSite).filter(DiveSite.id == site_id).first()
        if not site or site.difficulty_id is None:
            return True 
        return site.difficulty_id <= max_level

    async def generate_response(self, request: ChatRequest, intent: SearchIntent, data: List[Dict], weather_data: Optional[Dict] = None) -> str:
        """
        Generate a natural language response using OpenAI.
        """
        system_prompt = """
You are the Divemap Assistant, an expert diving guide.
Answer the user's question based ONLY on the provided <data> context.

# Constraints
1. **Tone**: Helpful, enthusiastic, professional.
2. **Safety**: Prioritize safety warnings if applicable.
3. **Links**: ALWAYS link to entities using the provided `route_path` in markdown. Example: [Site Name](/dive-sites/123).
4. **Scope**: If no results are provided in <search_results>, say you couldn't find any.
5. **Format**: Use bullet points.
6. **Weather**: Use the 'suitability' and 'reasoning' fields to advise the user.
"""
        data_context = "<search_results>\n"
        if not data:
            data_context += "No relevant results found.\n"
        else:
            for item in data:
                data_context += f"- {item['entity_type']} (Name: {item['name']}, route_path: {item.get('route_path')})\n"
                if item.get('description'):
                    data_context += f"  Description: {item['description'][:200]}\n"
                if 'suitability' in item:
                    data_context += f"  Weather: {item['suitability']} ({item['suitability_reasoning']})\n"
        data_context += "</search_results>"

        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "system", "content": data_context}
        ]
        
        for msg in request.history[-5:]:
            messages.append({"role": msg.role.value, "content": msg.content})
            
        messages.append({"role": "user", "content": request.message})

        response = await openai_service.get_chat_completion(
            messages=messages,
            model="gpt-4o",
            temperature=0.7
        )
        return response

    async def process_message(self, request: ChatRequest, current_user: Optional[User] = None) -> ChatResponse:
        """
        The main pipeline: Extract -> Search -> Respond.
        """
        intent = await self.extract_search_intent(request)
        search_results = self.execute_search(intent, current_user)
        
        # Weather Integration
        weather_data = {}
        target_date_str = intent.date or (intent.date_range[0] if intent.date_range and len(intent.date_range) > 0 else None)
        target_date = None
        if target_date_str:
            try:
                target_date = date.fromisoformat(target_date_str)
            except (ValueError, TypeError):
                pass
        
        if target_date and search_results:
            target_dt = datetime.combine(target_date, datetime.min.time())
            site_coords = []
            site_id_map = {}
            for item in search_results:
                if item["entity_type"] == "dive_site" and "latitude" in item and item["latitude"]:
                    coords = (item["latitude"], item["longitude"])
                    site_coords.append(coords)
                    site_id_map[coords] = item["id"]
            
            if site_coords:
                weather_results = fetch_wind_data_batch(site_coords, target_dt)
                for coords, wind_data in weather_results.items():
                    if wind_data:
                        site_id = site_id_map[coords]
                        # We need shore_direction from DB for suitability
                        site = self.db.query(DiveSite).filter(DiveSite.id == site_id).first()
                        suitability = calculate_wind_suitability(
                            wind_direction=wind_data["wind_direction_10m"],
                            wind_speed=wind_data["wind_speed_10m"],
                            shore_direction=float(site.shore_direction) if site.shore_direction else None,
                            wind_gusts=wind_data.get("wind_gusts_10m"),
                            wave_height=wind_data.get("wave_height"),
                            wave_period=wind_data.get("wave_period")
                        )
                        weather_data[site_id] = suitability
                        for item in search_results:
                            if item["entity_type"] == "dive_site" and item["id"] == site_id:
                                item["suitability"] = suitability["suitability"]
                                item["suitability_reasoning"] = suitability["reasoning"]

        answer = await self.generate_response(request, intent, search_results, weather_data)
        
        return ChatResponse(
            response=answer,
            message_id=str(uuid.uuid4()),
            sources=search_results,
            intent=intent
        )
