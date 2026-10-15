"""
Bidirectional Unit Conversion Helpers for Scuba Sizing and Dive Metrics.
"""

from typing import Tuple


def kg_to_lbs(kg: float) -> float:
    return kg * 2.20462262


def lbs_to_kg(lbs: float) -> float:
    return lbs / 2.20462262


def cm_to_feet_inches(cm: int) -> Tuple[int, int]:
    total_inches = round(cm / 2.54)
    feet = total_inches // 12
    inches = total_inches % 12
    return feet, inches


def feet_inches_to_cm(feet: int, inches: int) -> int:
    total_inches = (feet * 12) + inches
    return round(total_inches * 2.54)


def eu_to_us_men_shoe(eu_size: float) -> float:
    return round((eu_size - 33.5) * 2) / 2.0


def us_men_to_eu_shoe(us_size: float) -> float:
    return round((us_size + 33.5) * 2) / 2.0


def meters_to_feet(m: float) -> float:
    return m * 3.28084


def feet_to_meters(ft: float) -> float:
    return ft / 3.28084


def bar_to_psi(bar: float) -> float:
    return bar * 14.5038


def psi_to_bar(psi: float) -> float:
    return psi / 14.5038


def celsius_to_fahrenheit(c: float) -> float:
    return (c * 9.0 / 5.0) + 32.0


def format_dual_measurement(
    val_metric: float, unit_metric: str, unit_imperial: str
) -> str:
    formatted_metric_val = (
        int(val_metric)
        if isinstance(val_metric, (int, float)) and float(val_metric).is_integer()
        else val_metric
    )
    if unit_metric == "m" and unit_imperial == "ft":
        ft = round(meters_to_feet(val_metric))
        return f"{formatted_metric_val}m ({ft}ft)"
    elif unit_metric == "kg" and unit_imperial == "lbs":
        lbs = round(kg_to_lbs(val_metric), 1)
        formatted_lbs = int(lbs) if lbs.is_integer() else lbs
        return f"{formatted_metric_val}kg ({formatted_lbs}lbs)"
    elif unit_metric == "°C" and unit_imperial == "°F":
        f = round(celsius_to_fahrenheit(val_metric))
        return f"{formatted_metric_val}°C ({f}°F)"
    return f"{formatted_metric_val} {unit_metric}"
