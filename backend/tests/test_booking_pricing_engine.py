import pytest

from app.models import DivingCenterBookingSettings, OctoUnit
from app.services.booking_pricing_service import (
    DEFAULT_PACKAGE_ITEMS,
    compute_participant_octo_pricing,
    resolve_package_items,
)


@pytest.fixture
def center_settings():
    return DivingCenterBookingSettings(
        diving_center_id=10,
        daily_insurance_price=5.0,
        rental_equipment_pricing={
            "currency": "EUR",
            "full_kit_package": 30.0,
            "package_items": [
                "regulator",
                "bcd",
                "wetsuit",
                "fins_boots",
                "mask_snorkel",
            ],
            "items": {
                "regulator": 10.0,
                "bcd": 10.0,
                "wetsuit": 10.0,
                "fins_boots": 8.0,
                "mask_snorkel": 5.0,
                "dive_computer": 10.0,
                "dive_torch": 8.0,
                "hood": 5.0,
                "gloves": 5.0,
                "smb": 5.0,
            },
            "tank_surcharges": {
                "12": 0.0,
                "15": 5.0,
                "10": 0.0,
                "al80": 0.0,
                "twinset": 15.0,
            },
            "gas_surcharges": {
                "air": 0.0,
                "ean32": 8.0,
                "ean36": 8.0,
                "custom": 15.0,
            },
        },
    )


@pytest.fixture
def own_gear_unit():
    return OctoUnit(
        id="unit-own-gear",
        title="Certified Diver (Own Gear)",
        retail_price=85.0,
        unit_type="DIVER_OWN_GEAR",
    )


@pytest.fixture
def full_rental_unit():
    return OctoUnit(
        id="unit-full-rental",
        title="Certified Diver (Full Equipment Rental)",
        retail_price=115.0,
        unit_type="DIVER_RENTAL_GEAR",
    )


def test_standard_own_gear_pricing(center_settings, own_gear_unit):
    eq = {"selected_tank_id": "12", "selected_gas_mix_id": "air"}
    pricing = compute_participant_octo_pricing(center_settings, own_gear_unit, eq)
    assert pricing["total_due"] == 85.0
    assert len(pricing["line_items"]) == 1
    assert pricing["line_items"][0]["category"] == "BASE_TRIP"


def test_tank_and_gas_surcharges_applied(center_settings, own_gear_unit):
    eq = {
        "selected_tank_id": "15",
        "selected_gas_mix_id": "ean32",
    }
    pricing = compute_participant_octo_pricing(center_settings, own_gear_unit, eq)
    assert pricing["total_due"] == 85.0 + 5.0 + 8.0
    tank_item = next(
        i for i in pricing["line_items"] if i["category"] == "CYLINDER_UPGRADE"
    )
    gas_item = next(i for i in pricing["line_items"] if i["category"] == "GAS_UPGRADE")
    assert tank_item["amount"] == 5.0
    assert gas_item["amount"] == 8.0


def test_tank_gas_from_explicit_kwargs_not_sizing(center_settings, own_gear_unit):
    """Mirrors real OCTO hold: tank/gas live on unit-item columns, not sizing JSON."""
    eq = {}  # empty sizing, as wizard currently sends
    pricing = compute_participant_octo_pricing(
        center_settings,
        own_gear_unit,
        eq,
        selected_tank_id="15",
        selected_gas_mix_id="ean32",
    )
    assert pricing["total_due"] == 85.0 + 5.0 + 8.0
    assert any(i["category"] == "CYLINDER_UPGRADE" for i in pricing["line_items"])
    assert any(i["category"] == "GAS_UPGRADE" for i in pricing["line_items"])


def test_kwargs_override_sizing_tank_gas(center_settings, own_gear_unit):
    eq = {"selected_tank_id": "12", "selected_gas_mix_id": "air"}
    pricing = compute_participant_octo_pricing(
        center_settings,
        own_gear_unit,
        eq,
        selected_tank_id="15",
        selected_gas_mix_id="ean32",
    )
    assert pricing["total_due"] == 98.0


def test_own_gear_with_full_kit_matches_full_rental_tier(
    center_settings, own_gear_unit, full_rental_unit
):
    core_eq = {
        "selected_tank_id": "12",
        "selected_gas_mix_id": "air",
        "wetsuit_size": "L",
        "bcd_size": "M",
        "rental_regulator": True,
        "fin_size": "L",
        "rental_mask": True,
    }
    own_pricing = compute_participant_octo_pricing(
        center_settings, own_gear_unit, core_eq
    )
    full_pricing = compute_participant_octo_pricing(
        center_settings, full_rental_unit, core_eq
    )

    assert own_pricing["total_due"] == 115.0
    assert full_pricing["total_due"] == 115.0
    assert own_pricing["total_due"] == full_pricing["total_due"]


def test_dynamic_package_items_custom_bundle(
    center_settings, full_rental_unit, own_gear_unit
):
    center_settings.rental_equipment_pricing["package_items"] = [
        "regulator",
        "bcd",
        "wetsuit",
        "fins_boots",
        "mask_snorkel",
        "dive_computer",
        "hood",
    ]

    eq = {
        "selected_tank_id": "12",
        "selected_gas_mix_id": "air",
        "wetsuit_size": "L",
        "bcd_size": "M",
        "rental_regulator": True,
        "fin_size": "L",
        "rental_mask": True,
        "rental_dive_computer": True,
        "hood_size": "M",
        "hood_option": "RENT",
    }
    full_pricing = compute_participant_octo_pricing(
        center_settings, full_rental_unit, eq
    )
    own_pricing = compute_participant_octo_pricing(center_settings, own_gear_unit, eq)

    assert full_pricing["total_due"] == 115.0
    assert own_pricing["total_due"] == 115.0


def test_empty_package_items_falls_back_to_defaults(center_settings, full_rental_unit):
    center_settings.rental_equipment_pricing["package_items"] = []
    assert resolve_package_items(center_settings.rental_equipment_pricing) == set(
        DEFAULT_PACKAGE_ITEMS
    )

    eq = {
        "wetsuit_size": "L",
        "bcd_size": "M",
        "rental_regulator": True,
        "fin_size": "L",
        "rental_mask": True,
    }
    pricing = compute_participant_octo_pricing(center_settings, full_rental_unit, eq)
    # Full rental + default package → no double-charge of core kit
    assert pricing["total_due"] == 115.0
    assert not any(i["category"] == "AUXILIARY_RENTAL" for i in pricing["line_items"])


def test_negative_tank_surcharge_raises_error(center_settings, own_gear_unit):
    center_settings.rental_equipment_pricing["tank_surcharges"]["twinset"] = -1.0
    eq = {"selected_tank_id": "twinset", "selected_gas_mix_id": "air"}
    with pytest.raises(ValueError, match="not offered"):
        compute_participant_octo_pricing(center_settings, own_gear_unit, eq)


def test_negative_gas_surcharge_raises_error(center_settings, own_gear_unit):
    center_settings.rental_equipment_pricing["gas_surcharges"]["custom"] = -1.0
    eq = {"selected_tank_id": "12", "selected_gas_mix_id": "custom"}
    with pytest.raises(ValueError, match="not offered"):
        compute_participant_octo_pricing(center_settings, own_gear_unit, eq)


def test_not_offered_item_raises_when_requested(center_settings, own_gear_unit):
    center_settings.rental_equipment_pricing["items"]["dive_torch"] = -1.0
    eq = {
        "torch_option": "RENT",
        "rental_torch": True,
    }
    with pytest.raises(ValueError, match="not offered"):
        compute_participant_octo_pricing(center_settings, own_gear_unit, eq)


def test_not_offered_item_ok_when_not_requested(center_settings, own_gear_unit):
    center_settings.rental_equipment_pricing["items"]["dive_torch"] = -1.0
    eq = {"torch_option": "NONE"}
    pricing = compute_participant_octo_pricing(center_settings, own_gear_unit, eq)
    assert pricing["total_due"] == 85.0


def test_three_way_none_and_own_not_charged(center_settings, own_gear_unit):
    for option in ("NONE", "OWN"):
        eq = {
            "torch_option": option,
            "rental_torch": True,  # stale flag must not win over OWN/NONE
            "smb_option": option,
            "rental_smb": True,
            "hood_option": option,
            "hood_size": "M",
            "gloves_option": option,
            "gloves_size": "M",
        }
        pricing = compute_participant_octo_pricing(center_settings, own_gear_unit, eq)
        assert pricing["total_due"] == 85.0, f"option={option}"
        assert not any(
            i["id"] in ("rental_torch", "rental_smb", "rental_hood", "rental_gloves")
            for i in pricing["line_items"]
        )


def test_three_way_rent_charges(center_settings, own_gear_unit):
    eq = {
        "torch_option": "RENT",
        "smb_option": "RENT",
        "hood_option": "RENT",
        "hood_size": "M",
        "gloves_option": "RENT",
        "gloves_size": "L",
    }
    pricing = compute_participant_octo_pricing(center_settings, own_gear_unit, eq)
    assert pricing["total_due"] == 85.0 + 8.0 + 5.0 + 5.0 + 5.0


def test_boots_use_fins_boots_center_price(center_settings, own_gear_unit):
    eq = {"boot_size": "43", "rental_boots": True}
    pricing = compute_participant_octo_pricing(center_settings, own_gear_unit, eq)
    boots = next(i for i in pricing["line_items"] if i["id"] == "rental_boots")
    assert boots["amount"] == 8.0  # from items.fins_boots, not hardcoded 5


def test_boots_not_offered_raises(center_settings, own_gear_unit):
    center_settings.rental_equipment_pricing["items"]["fins_boots"] = -1.0
    eq = {"boot_size": "43"}
    with pytest.raises(ValueError, match="not offered"):
        compute_participant_octo_pricing(center_settings, own_gear_unit, eq)


def test_missing_package_items_key_uses_defaults(center_settings, full_rental_unit):
    del center_settings.rental_equipment_pricing["package_items"]
    eq = {
        "wetsuit_size": "L",
        "bcd_size": "M",
        "rental_regulator": True,
        "fin_size": "L",
        "rental_mask": True,
    }
    pricing = compute_participant_octo_pricing(center_settings, full_rental_unit, eq)
    assert pricing["total_due"] == 115.0


def test_legacy_torch_smb_flags_without_option_still_charge(
    center_settings, own_gear_unit
):
    """Pre-3-way payloads: rental_* True and option unset → bill Rent."""
    eq = {"rental_torch": True, "rental_smb": True}
    pricing = compute_participant_octo_pricing(center_settings, own_gear_unit, eq)
    assert pricing["total_due"] == 85.0 + 8.0 + 5.0


def test_legacy_hood_size_without_option_charges(center_settings, own_gear_unit):
    eq = {"hood_size": "M", "gloves_size": "L"}
    pricing = compute_participant_octo_pricing(center_settings, own_gear_unit, eq)
    assert pricing["total_due"] == 85.0 + 5.0 + 5.0


def test_full_rental_aux_outside_package_still_charged(
    center_settings, full_rental_unit
):
    eq = {
        "wetsuit_size": "L",
        "bcd_size": "M",
        "rental_regulator": True,
        "fin_size": "L",
        "rental_mask": True,
        "torch_option": "RENT",
        "smb_option": "RENT",
    }
    pricing = compute_participant_octo_pricing(center_settings, full_rental_unit, eq)
    # Base 115 + torch 8 + smb 5 (aux, not in default package)
    assert pricing["total_due"] == 115.0 + 8.0 + 5.0


def test_not_offered_hood_raises_when_rent_requested(center_settings, own_gear_unit):
    center_settings.rental_equipment_pricing["items"]["hood"] = -1.0
    eq = {"hood_option": "RENT", "hood_size": "M"}
    with pytest.raises(ValueError, match="not offered"):
        compute_participant_octo_pricing(center_settings, own_gear_unit, eq)
