import pytest
from app.constants.cylinders import (
    TANK_SIZES,
    TANK_SIZES_BY_ID,
    GAS_MIXES,
    GAS_MIXES_BY_ID,
    get_tank_spec,
    get_gas_mix_spec,
)
from app.utils.unit_conversion import (
    cm_to_feet_inches,
    feet_inches_to_cm,
    kg_to_lbs,
    lbs_to_kg,
    eu_to_us_men_shoe,
    us_men_to_eu_shoe,
    meters_to_feet,
    feet_to_meters,
    bar_to_psi,
    psi_to_bar,
    celsius_to_fahrenheit,
    format_dual_measurement,
)


def test_cylinder_constants_exist():
    assert "12" in TANK_SIZES_BY_ID
    assert TANK_SIZES_BY_ID["12"]["size"] == 12
    assert TANK_SIZES_BY_ID["12"]["material"] == "steel"

    assert "al80" in TANK_SIZES_BY_ID
    assert TANK_SIZES_BY_ID["al80"]["size"] == 11.1
    assert TANK_SIZES_BY_ID["al80"]["material"] == "alu"

    assert "15" in TANK_SIZES_BY_ID
    assert get_tank_spec("15")["name"] == "15 Liters"

    assert "ean32" in GAS_MIXES_BY_ID
    assert get_gas_mix_spec("ean32")["o2"] == 32

    # Default fallbacks
    assert get_tank_spec("non_existent")["id"] == "12"
    assert get_gas_mix_spec("non_existent")["id"] == "air"


def test_weight_conversion():
    assert round(kg_to_lbs(75.0), 1) == 165.3
    assert round(lbs_to_kg(165.347), 1) == 75.0
    # Lead weight test
    assert round(kg_to_lbs(4.0), 1) == 8.8
    assert round(lbs_to_kg(8.818), 1) == 4.0


def test_height_conversion():
    feet, inches = cm_to_feet_inches(180)
    assert feet == 5 and inches == 11
    assert feet_inches_to_cm(5, 11) == 180


def test_shoe_conversion():
    assert eu_to_us_men_shoe(43.0) == 9.5
    assert us_men_to_eu_shoe(9.5) == 43.0


def test_distance_and_pressure_and_temp():
    assert round(meters_to_feet(30.0), 1) == 98.4
    assert round(feet_to_meters(98.4252), 1) == 30.0

    assert round(bar_to_psi(200.0)) == 2901
    assert round(psi_to_bar(2900.76)) == 200

    assert round(celsius_to_fahrenheit(20.0)) == 68


def test_format_dual_measurement():
    formatted = format_dual_measurement(30.0, "m", "ft")
    assert "30m" in formatted and "98ft" in formatted

    formatted_kg = format_dual_measurement(75.0, "kg", "lbs")
    assert "75kg" in formatted_kg and "165.3lbs" in formatted_kg

    formatted_temp = format_dual_measurement(25.0, "°C", "°F")
    assert "25°C" in formatted_temp and "77°F" in formatted_temp
