import pytest
from app.services.waiver_service import WaiverService

def test_dmsc_evaluation_all_negative():
    answers = {f"q{i}": False for i in range(1, 11)}
    status = WaiverService.evaluate_dmsc_medical(answers)
    assert status == "CLEARED"

def test_dmsc_evaluation_direct_physician_flag():
    # Q3, Q5, Q10 are direct physician flags
    for q in ["q3", "q5", "q10"]:
        answers = {f"q{i}": False for i in range(1, 11)}
        answers[q] = True
        assert WaiverService.evaluate_dmsc_medical(answers) == "FLAGGED_CONTACT_CENTER"

def test_dmsc_evaluation_box_triggered_and_cleared():
    # Answering YES to Q1 triggers Box A.
    # If all Box A questions are NO, the diver is CLEARED under DMSC 2020 protocol.
    answers = {f"q{i}": False for i in range(1, 11)}
    answers["q1"] = True
    answers["box_a"] = {
        "box_a_1": False,
        "box_a_2": False,
        "box_a_3": False,
        "box_a_4": False,
        "box_a_5": False,
    }
    status = WaiverService.evaluate_dmsc_medical(answers)
    assert status == "CLEARED"

def test_dmsc_evaluation_box_triggered_and_flagged():
    # Answering YES to Q1 triggers Box A.
    # If ANY Box A question is YES, the diver is FLAGGED.
    answers = {f"q{i}": False for i in range(1, 11)}
    answers["q1"] = True
    answers["box_a"] = {
        "box_a_1": False,
        "box_a_2": False,
        "box_a_3": True, # Asthma/wheezing in past 12 months
        "box_a_4": False,
        "box_a_5": False,
    }
    status = WaiverService.evaluate_dmsc_medical(answers)
    assert status == "FLAGGED_CONTACT_CENTER"

def test_dmsc_evaluation_box_triggered_but_unanswered():
    # Answering YES to Q1 without completing Box A is incomplete -> FLAGGED
    answers = {f"q{i}": False for i in range(1, 11)}
    answers["q1"] = True
    status = WaiverService.evaluate_dmsc_medical(answers)
    assert status == "FLAGGED_CONTACT_CENTER"

def test_get_dmsc_questionnaire_schema():
    service = WaiverService()
    schema = service.get_questionnaire_schema("dmsc_2020_medical")
    assert schema["id"] == "dmsc_2020_medical"
    assert len(schema["primary_questions"]) == 10
    assert "box_a" in schema["diagnostic_boxes"]

def test_get_questionnaire_schema_path_traversal_prevention():
    service = WaiverService()
    with pytest.raises(ValueError, match="Invalid questionnaire identifier"):
        service.get_questionnaire_schema("../../../etc/passwd")

def test_waiver_rendering_padi_certified_boat():
    service = WaiverService()
    context = {
        "diver_full_name": "Jacques Cousteau",
        "diving_center_name": "Aegean Divers",
        "dive_date": "2026-10-01",
        "signed_at": "2026-09-27 16:00:00 UTC",
    }
    html = service.render_waiver("padi_certified_boat", context)
    assert "Jacques Cousteau" in html
    assert "Aegean Divers" in html
    assert "PADI Form 10086" in html

def test_waiver_rendering_padi_eu_statement():
    service = WaiverService()
    context = {
        "diver_full_name": "Enzo Maiorca",
        "diving_center_name": "Mediterranean Scuba",
        "dive_date": "2026-10-02",
        "signed_at": "2026-09-27 16:05:00 UTC",
    }
    html = service.render_waiver("padi_10175_eu", context)
    assert "Enzo Maiorca" in html
    assert "Mediterranean Scuba" in html
    assert "EU Version" in html

def test_waiver_rendering_universal_fallback():
    service = WaiverService()
    context = {
        "diver_full_name": "Sylvia Earle",
        "diving_center_name": "Deep Ocean Explorers",
        "dive_date": "2026-10-03",
        "signed_at": "2026-09-27 16:10:00 UTC",
    }
    html = service.render_waiver("unknown_bundle_id", context)
    assert "Sylvia Earle" in html
    assert "Deep Ocean Explorers" in html
