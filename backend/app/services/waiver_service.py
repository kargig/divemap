import logging
import os
import re
from typing import Any, Dict, Optional

import orjson
from jinja2 import Environment, FileSystemLoader, select_autoescape

logger = logging.getLogger(__name__)

TEMPLATES_DIR = os.path.abspath(
    os.path.join(os.path.dirname(__file__), "..", "templates")
)

# DMSC 2020 Standard Question Classifications
DIRECT_PHYSICIAN_FLAG_QUESTIONS = {"q3", "q5", "q10"}
TRIGGERED_BOX_MAP = {
    "q1": "box_a",
    "q2": "box_b",
    "q4": "box_f",
    "q6": "box_d",
    "q7": "box_e",
    "q8": "box_c",
    "q9": "box_g",
}


class WaiverService:
    def __init__(self, templates_dir: Optional[str] = None):
        self.templates_dir = templates_dir or TEMPLATES_DIR
        self.jinja_env = Environment(
            loader=FileSystemLoader(self.templates_dir),
            autoescape=select_autoescape(["html", "xml", "j2"]),
        )

    @staticmethod
    def evaluate_dmsc_medical(answers: Dict[str, Any]) -> str:
        """
        Evaluates DMSC 2020 questionnaire answers according to clinical guidelines:
        - If Q3, Q5, or Q10 is YES -> FLAGGED_CONTACT_CENTER (Direct physician clearance needed).
        - If Q1, Q2, Q4, Q6, Q7, Q8, or Q9 is YES:
            - If the corresponding diagnostic box has ANY YES -> FLAGGED_CONTACT_CENTER.
            - If the corresponding diagnostic box has ALL NO -> CLEARED (Box cleared).
            - If the corresponding diagnostic box was not answered -> FLAGGED_CONTACT_CENTER (Incomplete).
        - If all answered questions are NO -> CLEARED.
        """
        if not answers or not isinstance(answers, dict):
            return "FLAGGED_CONTACT_CENTER"

        # 1. Direct physician flag questions
        for q_id in DIRECT_PHYSICIAN_FLAG_QUESTIONS:
            if answers.get(q_id) is True:
                return "FLAGGED_CONTACT_CENTER"

        # 2. Triggered diagnostic boxes
        for q_id, box_name in TRIGGERED_BOX_MAP.items():
            if answers.get(q_id) is True:
                # Find sub-box responses (could be directly keyed as box_a, or in a nested "boxes" dict)
                box_answers = answers.get(box_name)
                if not box_answers and isinstance(answers.get("boxes"), dict):
                    box_answers = answers["boxes"].get(box_name)

                if not box_answers or not isinstance(box_answers, dict):
                    # Flagged primary question was answered Yes, but sub-box was not completed
                    return "FLAGGED_CONTACT_CENTER"

                # If ANY question in the triggered box is YES, physician sign-off is required
                if any(
                    val is True for val in box_answers.values() if isinstance(val, bool)
                ):
                    return "FLAGGED_CONTACT_CENTER"

        # 3. Check for any direct diagnostic box answers submitted that might be True
        for key, val in answers.items():
            if key.startswith("box_") and isinstance(val, dict):
                if any(
                    sub_val is True
                    for sub_val in val.values()
                    if isinstance(sub_val, bool)
                ):
                    return "FLAGGED_CONTACT_CENTER"

        return "CLEARED"

    def get_questionnaire_schema(
        self, questionnaire_id: str = "dmsc_2020_medical"
    ) -> Dict[str, Any]:
        """
        Loads the declarative JSON schema for a medical questionnaire with path-traversal protection.
        """
        if not re.match(r"^[a-zA-Z0-9_-]+$", questionnaire_id):
            raise ValueError(f"Invalid questionnaire identifier: {questionnaire_id}")

        schema_dir = os.path.abspath(
            os.path.join(self.templates_dir, "booking", "questionnaires")
        )
        schema_path = os.path.abspath(
            os.path.join(schema_dir, f"{questionnaire_id}.json")
        )

        if not schema_path.startswith(schema_dir) or not os.path.exists(schema_path):
            raise FileNotFoundError(
                f"Questionnaire schema '{questionnaire_id}' not found at {schema_path}"
            )

        with open(schema_path, "rb") as f:
            return orjson.loads(f.read())

    def render_waiver(self, bundle_id: str, context: Dict[str, Any]) -> str:
        """
        Renders a Jinja2 legal waiver template based on the bundle identifier.
        """
        bundle_map = {
            "padi_certified_boat": "booking/waivers/padi/10086_certified_diver_release.html.j2",
            "padi_10086": "booking/waivers/padi/10086_certified_diver_release.html.j2",
            "padi_10175_eu": "booking/waivers/padi/10175_eu_statement_of_risk.html.j2",
            "padi_eu": "booking/waivers/padi/10175_eu_statement_of_risk.html.j2",
            "universal": "booking/waivers/universal/generic_dive_center_waiver.html.j2",
            "dmsc_recreational": "booking/waivers/universal/generic_dive_center_waiver.html.j2",
        }

        template_file = bundle_map.get(
            bundle_id, "booking/waivers/universal/generic_dive_center_waiver.html.j2"
        )
        template = self.jinja_env.get_template(template_file)
        return template.render(**context)
