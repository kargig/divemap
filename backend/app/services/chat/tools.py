from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field

# Tool Schemas for OpenAI Function Calling

class SearchDiveSitesTool(BaseModel):
    """Search for dive sites based on location, keywords, difficulty, and geography."""
    location: Optional[str] = Field(None, description="City, island, or specific area name (e.g. 'Athens', 'Naxos')")
    parent_region: Optional[str] = Field(None, description="The larger administrative region (e.g. 'Attica', 'Cyclades')")
    keywords: Optional[List[str]] = Field(None, description="Specific features or types (e.g. ['wreck', 'cave', 'deep', 'highest_rated'])")
    latitude: Optional[float] = Field(None, description="Approximate latitude for spatial search")
    longitude: Optional[float] = Field(None, description="Approximate longitude for spatial search")
    radius: Optional[float] = Field(20.0, description="Search radius in kilometers")
    direction: Optional[str] = Field(None, description="Cardinal direction relative to location (e.g. 'north', 'southeast')")
    difficulty_level: Optional[int] = Field(None, description="1 (Beginner) to 4 (Technical)")

class SearchDiveRoutesTool(BaseModel):
    """Search for specific user-created dive routes and paths based on points of interest (POIs), marine life sightings in comments, or route types. Combined with 'location', this is the best way to find specific features like 'corals' in a specific area."""
    location: Optional[str] = Field(None, description="General area, city, island, or dive site name to look for routes")
    poi_types: Optional[List[str]] = Field(None, description="Specific features marked on the route map. PREFER using this over 'poi_search' for common items like ['wreck', 'cave', 'coral', 'life', 'artifacts', 'hazard', 'rock', 'wall', 'canyon'].")
    route_type: Optional[str] = Field(None, description="'scuba', 'swim' or 'walk'")
    poi_search: Optional[str] = Field(None, description="Specific text to search for inside marker comments. Use singular, root keywords (e.g., 'brain coral', not 'brain corals') for better matches.")
    latitude: Optional[float] = Field(None, description="Approximate latitude for spatial search")
    longitude: Optional[float] = Field(None, description="Approximate longitude for spatial search")
    radius: Optional[float] = Field(20.0, description="Search radius in kilometers")

class SearchDivingCentersTool(BaseModel):
    """Search for diving centers based on location and keywords. Use this to find courses and dive shop services."""
    location: Optional[str] = Field(None, description="City, island, or region name")
    keywords: Optional[List[str]] = Field(None, description="Specific services or names (e.g. ['PADI', 'nitrox'])")
    latitude: Optional[float] = Field(None, description="Approximate latitude")
    longitude: Optional[float] = Field(None, description="Approximate longitude")
    radius: Optional[float] = Field(30.0, description="Search radius in kilometers")

class SearchGearRentalTool(BaseModel):
    """Search for gear rental prices and diving centers that rent equipment (e.g., tanks, regulators, wetsuits)."""
    location: Optional[str] = Field(None, description="City, island, or region name")
    keywords: Optional[List[str]] = Field(None, description="Specific gear items (e.g. ['tank', 'regulator', 'wetsuit'])")
    latitude: Optional[float] = Field(None, description="Approximate latitude")
    longitude: Optional[float] = Field(None, description="Approximate longitude")
    radius: Optional[float] = Field(30.0, description="Search radius in kilometers")

class SearchMarineLifeTool(BaseModel):
    """Find dive sites where specific marine life can be seen. For more detailed user-reported sightings, also check dive routes."""
    marine_species: List[str] = Field(..., description="Species to look for (e.g. ['turtles', 'monk seals', 'nudibranchs'])")
    location: Optional[str] = Field(None, description="Preferred area for the search")
    latitude: Optional[float] = Field(None, description="Approximate latitude")
    longitude: Optional[float] = Field(None, description="Approximate longitude")

class CalculateDivingPhysicsTool(BaseModel):
    """Perform diving calculations like MOD, SAC, EAD, or Minimum Gas."""
    calculation_type: str = Field(..., description="Type of calculation: 'mod', 'sac', 'best_mix', 'ead_end', or 'min_gas'")
    depth: Optional[float] = Field(None, description="Depth in meters")
    o2_percent: Optional[float] = Field(None, description="Oxygen percentage (e.g. 21.0, 32.0)")
    he_percent: Optional[float] = Field(None, description="Helium percentage (e.g. 0.0, 30.0)")
    duration: Optional[float] = Field(None, description="Bottom time or segment duration in minutes")
    tank_volume: Optional[float] = Field(12.0, description="Tank size in liters")
    start_pressure: Optional[float] = Field(None, description="Starting tank pressure in bar")
    end_pressure: Optional[float] = Field(None, description="Ending tank pressure in bar")
    sac_rate: Optional[float] = Field(None, description="Surface Air Consumption rate in L/min")
    pp_o2_max: Optional[float] = Field(1.4, description="Maximum partial pressure of oxygen. Assume 1.4 if not explicitly provided by the user.")

class CompareCertificationsTool(BaseModel):
    """Compare the technical specifications, depths, and prerequisites of two or more diving certifications."""
    courses_to_compare: List[str] = Field(..., description="The names of the courses to compare (e.g. ['Tec 45', 'XR Extended Range'])")

class GetCertificationPathTool(BaseModel):
    """Get the prerequisites or the next steps for a specific certification, or view an agency's entire career path."""
    course_name: Optional[str] = Field(None, description="The specific course the user is asking about (e.g., 'Rescue Diver')")
    organization: Optional[str] = Field(None, description="The agency (e.g., 'PADI', 'SSI')")
    path_direction: Optional[str] = Field("full", description="'prerequisites', 'next_steps', or 'full'")

class GetDiveSiteDetailsTool(BaseModel):
    """Get detailed historical information, full descriptions, and access instructions for a specific named dive site."""
    site_name: str = Field(..., description="The exact name of the dive site (e.g., 'Kyra Leni', 'Zenobia')")

class SearchDivingTripsTool(BaseModel):
    """Find scheduled boat trips or diving excursions happening on specific dates."""
    location: Optional[str] = Field(None, description="Where the trip is taking place")
    start_date: Optional[str] = Field(None, description="YYYY-MM-DD")
    end_date: Optional[str] = Field(None, description="YYYY-MM-DD")

class GetWeatherSuitabilityTool(BaseModel):
    """Get weather forecast and diving suitability for a specific location and time."""
    location: Optional[str] = Field(None, description="Location name")
    latitude: float = Field(..., description="Latitude of the site")
    longitude: float = Field(..., description="Longitude of the site")
    date: str = Field(..., description="Target date in YYYY-MM-DD format")
    time: Optional[str] = Field("10:00", description="Target time in HH:MM format")

class RecommendDiveSitesTool(BaseModel):
    """Get personalized dive site recommendations for the user based on their skills and location."""
    location: Optional[str] = Field(None, description="Preferred area for recommendations")
    latitude: Optional[float] = Field(None, description="Approximate latitude")
    longitude: Optional[float] = Field(None, description="Approximate longitude")

class GetUserDiveLogsTool(BaseModel):
    """Retrieve the user's personal dive logs (history, dates, depths, sites)."""
    limit: Optional[int] = Field(5, description="Number of recent dives to retrieve")
    dive_site_name: Optional[str] = Field(None, description="Filter logs by a specific dive site")

class GetReviewsAndCommentsTool(BaseModel):
    """Fetch user reviews, ratings, and comments for a specific dive site or diving center."""
    entity_type: str = Field(..., description="Must be 'dive_site' or 'diving_center'")
    entity_name: str = Field(..., description="Name of the dive site or diving center")

class AskUserForClarificationTool(BaseModel):
    """Ask the user for more information when the query is too ambiguous or missing vital data."""
    question: str = Field(..., description="The clarification question to ask the user")

# Helper to export as OpenAI tools format
CHAT_TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "search_dive_sites",
            "description": SearchDiveSitesTool.__doc__,
            "parameters": SearchDiveSitesTool.model_json_schema()
        }
    },
    {
        "type": "function",
        "function": {
            "name": "search_dive_routes",
            "description": SearchDiveRoutesTool.__doc__,
            "parameters": SearchDiveRoutesTool.model_json_schema()
        }
    },
    {
        "type": "function",
        "function": {
            "name": "search_diving_centers",
            "description": SearchDivingCentersTool.__doc__,
            "parameters": SearchDivingCentersTool.model_json_schema()
        }
    },
    {
        "type": "function",
        "function": {
            "name": "search_marine_life",
            "description": SearchMarineLifeTool.__doc__,
            "parameters": SearchMarineLifeTool.model_json_schema()
        }
    },
    {
        "type": "function",
        "function": {
            "name": "calculate_diving_physics",
            "description": CalculateDivingPhysicsTool.__doc__,
            "parameters": CalculateDivingPhysicsTool.model_json_schema()
        }
    },
    {
        "type": "function",
        "function": {
            "name": "search_gear_rental",
            "description": SearchGearRentalTool.__doc__,
            "parameters": SearchGearRentalTool.model_json_schema()
        }
    },
    {
        "type": "function",
        "function": {
            "name": "compare_certifications",
            "description": CompareCertificationsTool.__doc__,
            "parameters": CompareCertificationsTool.model_json_schema()
        }
    },
    {
        "type": "function",
        "function": {
            "name": "get_certification_path",
            "description": GetCertificationPathTool.__doc__,
            "parameters": GetCertificationPathTool.model_json_schema()
        }
    },
    {
        "type": "function",
        "function": {
            "name": "get_dive_site_details",
            "description": GetDiveSiteDetailsTool.__doc__,
            "parameters": GetDiveSiteDetailsTool.model_json_schema()
        }
    },
    {
        "type": "function",
        "function": {
            "name": "search_diving_trips",
            "description": SearchDivingTripsTool.__doc__,
            "parameters": SearchDivingTripsTool.model_json_schema()
        }
    },
    {
        "type": "function",
        "function": {
            "name": "get_weather_suitability",
            "description": GetWeatherSuitabilityTool.__doc__,
            "parameters": GetWeatherSuitabilityTool.model_json_schema()
        }
    },
    {
        "type": "function",
        "function": {
            "name": "recommend_dive_sites",
            "description": RecommendDiveSitesTool.__doc__,
            "parameters": RecommendDiveSitesTool.model_json_schema()
        }
    },
    {
        "type": "function",
        "function": {
            "name": "get_user_dive_logs",
            "description": GetUserDiveLogsTool.__doc__,
            "parameters": GetUserDiveLogsTool.model_json_schema()
        }
    },
    {
        "type": "function",
        "function": {
            "name": "get_reviews_and_comments",
            "description": GetReviewsAndCommentsTool.__doc__,
            "parameters": GetReviewsAndCommentsTool.model_json_schema()
        }
    },
    {
        "type": "function",
        "function": {
            "name": "ask_user_for_clarification",
            "description": AskUserForClarificationTool.__doc__,
            "parameters": AskUserForClarificationTool.model_json_schema()
        }
    }
]
