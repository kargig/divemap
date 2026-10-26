from typing import Any

from app.models import DivingCenterBookingSettings, OctoUnit


def compute_participant_octo_pricing(
    center_settings: DivingCenterBookingSettings | None,
    unit: OctoUnit | None,
    equipment_sizing: dict[str, Any] | None,
    currency: str = "EUR",
) -> dict[str, Any]:
    """
    Computes OCTO-compliant pricing object, line items breakdown, and package caps for a diver.
    Conforms to the OCTO Travel API specification for octo/pricing capability.
    """
    eq = equipment_sizing or {}
    pricing_config = (
        center_settings.rental_equipment_pricing if center_settings else None
    )
    items_pricing = pricing_config.get("items", {}) if pricing_config else {}
    full_pkg_rate = (
        float(pricing_config.get("full_kit_package", 30.0)) if pricing_config else 30.0
    )

    # Base unit retail price — unit must come from DB; client flags do not pick package tier
    if unit is None:
        raise ValueError(
            "OctoUnit is required for pricing; unknown unitId is not allowed"
        )
    base_retail = float(unit.retail_price)
    unit_title = unit.title or "Certified Diver"
    unit_type = (getattr(unit, "unit_type", None) or "").upper()
    is_full_rental_unit = (
        unit_type == "DIVER_RENTAL_GEAR"
        or "rental" in unit_title.lower()
        or (getattr(unit, "id", "") == "certified-diver-full-rental")
    )

    base_line_item = {
        "id": "base_trip",
        "title": f"Base Dive Trip: {unit_title}",
        "category": "BASE_TRIP",
        "quantity": 1,
        "amount": base_retail,
        "price": int(round(base_retail * 100)),
        "formatted": f"€{base_retail:.2f}",
    }

    core_rental_items = []
    aux_rental_items = []

    if is_full_rental_unit:
        # Full package tier covers core kit; auxiliary items are charged extra
        if eq.get("rental_torch") and items_pricing.get("dive_torch"):
            p = float(items_pricing["dive_torch"])
            aux_rental_items.append(
                {
                    "id": "rental_torch",
                    "title": "Rental Primary Dive Torch",
                    "category": "AUXILIARY_RENTAL",
                    "quantity": 1,
                    "amount": p,
                    "price": int(round(p * 100)),
                    "formatted": f"€{p:.2f}",
                }
            )
        if eq.get("rental_dive_computer") and items_pricing.get("dive_computer"):
            p = float(items_pricing["dive_computer"])
            aux_rental_items.append(
                {
                    "id": "rental_computer",
                    "title": "Rental Dive Computer (Wrist Unit)",
                    "category": "AUXILIARY_RENTAL",
                    "quantity": 1,
                    "amount": p,
                    "price": int(round(p * 100)),
                    "formatted": f"€{p:.2f}",
                }
            )
        if eq.get("rental_scooter") and items_pricing.get("dpv_scooter"):
            p = float(items_pricing["dpv_scooter"])
            aux_rental_items.append(
                {
                    "id": "rental_scooter",
                    "title": "DPV Underwater Scooter",
                    "category": "AUXILIARY_RENTAL",
                    "quantity": 1,
                    "amount": p,
                    "price": int(round(p * 100)),
                    "formatted": f"€{p:.2f}",
                }
            )
        if (
            eq.get("stage_tank")
            and eq.get("stage_tank") != "None"
            and items_pricing.get("stage_tank")
        ):
            p = float(items_pricing["stage_tank"])
            aux_rental_items.append(
                {
                    "id": "stage_cylinder",
                    "title": f"Stage Cylinder ({eq.get('stage_tank')})",
                    "category": "AUXILIARY_RENTAL",
                    "quantity": 1,
                    "amount": p,
                    "price": int(round(p * 100)),
                    "formatted": f"€{p:.2f}",
                }
            )
        if (
            eq.get("hood_size")
            and eq.get("hood_size") != "None"
            and items_pricing.get("hood")
        ):
            p = float(items_pricing["hood"])
            aux_rental_items.append(
                {
                    "id": "rental_hood",
                    "title": f"Rental Thermal Hood ({eq.get('hood_size')})",
                    "category": "AUXILIARY_RENTAL",
                    "quantity": 1,
                    "amount": p,
                    "price": int(round(p * 100)),
                    "formatted": f"€{p:.2f}",
                }
            )
        if (
            eq.get("gloves_size")
            and eq.get("gloves_size") != "None"
            and items_pricing.get("gloves")
        ):
            p = float(items_pricing["gloves"])
            aux_rental_items.append(
                {
                    "id": "rental_gloves",
                    "title": f"Rental Dive Gloves ({eq.get('gloves_size')})",
                    "category": "AUXILIARY_RENTAL",
                    "quantity": 1,
                    "amount": p,
                    "price": int(round(p * 100)),
                    "formatted": f"€{p:.2f}",
                }
            )
        if (
            (eq.get("rental_smb") or (eq.get("has_own_smb") is False and eq.get("rental_smb") is not False))
            and items_pricing.get("smb")
        ):
            p = float(items_pricing["smb"])
            aux_rental_items.append(
                {
                    "id": "rental_smb",
                    "title": "Rental Surface Marker Buoy (SMB) & Spool",
                    "category": "AUXILIARY_RENTAL",
                    "quantity": 1,
                    "amount": p,
                    "price": int(round(p * 100)),
                    "formatted": f"€{p:.2f}",
                }
            )

        ins_price = (
            float(getattr(center_settings, "daily_insurance_price", 0.0) or 0.0)
            if center_settings
            else 0.0
        )
        if eq.get("insurance_type") == "CENTER" and ins_price > 0:
            aux_rental_items.append(
                {
                    "id": "daily_insurance",
                    "title": "Diving Center Daily Dive Accident Insurance",
                    "category": "INSURANCE",
                    "quantity": 1,
                    "amount": ins_price,
                    "price": int(round(ins_price * 100)),
                    "formatted": f"€{ins_price:.2f}",
                }
            )

        total_rental = sum(item["amount"] for item in aux_rental_items)
        total_due = base_retail + total_rental
        package_cap = {
            "applied": True,
            "title": "Full Equipment Rental Package Bundle",
            "capPrice": int(round(full_pkg_rate * 100)),
            "savings": 0,
            "formattedSavings": "€0.00",
        }
        all_rental_items = aux_rental_items
    else:
        # Own gear diver selecting individual rental items à la carte
        if (
            eq.get("wetsuit_size")
            and eq.get("wetsuit_size") != "None"
            and items_pricing.get("wetsuit")
        ):
            p = float(items_pricing["wetsuit"])
            core_rental_items.append(
                {
                    "id": "rental_wetsuit",
                    "title": f"Rental Wetsuit ({eq.get('wetsuit_size')})",
                    "category": "CORE_RENTAL",
                    "quantity": 1,
                    "amount": p,
                    "price": int(round(p * 100)),
                    "formatted": f"€{p:.2f}",
                }
            )
        if (
            eq.get("bcd_size")
            and eq.get("bcd_size") != "None"
            and items_pricing.get("bcd")
        ):
            p = float(items_pricing["bcd"])
            core_rental_items.append(
                {
                    "id": "rental_bcd",
                    "title": f"Rental BCD ({eq.get('bcd_size')})",
                    "category": "CORE_RENTAL",
                    "quantity": 1,
                    "amount": p,
                    "price": int(round(p * 100)),
                    "formatted": f"€{p:.2f}",
                }
            )
        if (
            eq.get("rental_regulator")
            or (
                eq.get("has_own_regulator") is False
                and "rental_regulator" in eq
                and eq.get("rental_regulator")
            )
        ) and items_pricing.get("regulator"):
            p = float(items_pricing["regulator"])
            fitting_label = (
                f" ({eq.get('regulator_fitting', 'DIN')})"
                if eq.get("regulator_fitting")
                else ""
            )
            core_rental_items.append(
                {
                    "id": "rental_regulator",
                    "title": f"Rental Regulator Set{fitting_label}",
                    "category": "CORE_RENTAL",
                    "quantity": 1,
                    "amount": p,
                    "price": int(round(p * 100)),
                    "formatted": f"€{p:.2f}",
                }
            )
        if eq.get("rental_mask") and items_pricing.get("mask"):
            p = float(items_pricing["mask"])
            core_rental_items.append(
                {
                    "id": "rental_mask",
                    "title": "Rental Mask",
                    "category": "CORE_RENTAL",
                    "quantity": 1,
                    "amount": p,
                    "price": int(round(p * 100)),
                    "formatted": f"€{p:.2f}",
                }
            )
        if (
            eq.get("rental_fins")
            or (eq.get("fin_size") and eq.get("fin_size") != "None")
        ) and items_pricing.get("fins_boots"):
            p = float(items_pricing["fins_boots"])
            core_rental_items.append(
                {
                    "id": "rental_fins",
                    "title": f"Rental Fins ({eq.get('fin_size', 'Standard')})",
                    "category": "CORE_RENTAL",
                    "quantity": 1,
                    "amount": p,
                    "price": int(round(p * 100)),
                    "formatted": f"€{p:.2f}",
                }
            )
        elif eq.get("rental_boots") or (
            eq.get("boot_size") and eq.get("boot_size") != "None"
        ):
            p = 5.0
            core_rental_items.append(
                {
                    "id": "rental_boots",
                    "title": f"Rental Booties (EU {eq.get('boot_size', eq.get('shoe_size_eu', '43'))})",
                    "category": "CORE_RENTAL",
                    "quantity": 1,
                    "amount": p,
                    "price": int(round(p * 100)),
                    "formatted": f"€{p:.2f}",
                }
            )

        # Auxiliary items
        if eq.get("rental_dive_computer") and items_pricing.get("dive_computer"):
            p = float(items_pricing["dive_computer"])
            aux_rental_items.append(
                {
                    "id": "rental_computer",
                    "title": "Rental Dive Computer (Wrist Unit)",
                    "category": "AUXILIARY_RENTAL",
                    "quantity": 1,
                    "amount": p,
                    "price": int(round(p * 100)),
                    "formatted": f"€{p:.2f}",
                }
            )
        if eq.get("rental_torch") and items_pricing.get("dive_torch"):
            p = float(items_pricing["dive_torch"])
            aux_rental_items.append(
                {
                    "id": "rental_torch",
                    "title": "Rental Primary Dive Torch",
                    "category": "AUXILIARY_RENTAL",
                    "quantity": 1,
                    "amount": p,
                    "price": int(round(p * 100)),
                    "formatted": f"€{p:.2f}",
                }
            )
        if eq.get("rental_scooter") and items_pricing.get("dpv_scooter"):
            p = float(items_pricing["dpv_scooter"])
            aux_rental_items.append(
                {
                    "id": "rental_scooter",
                    "title": "DPV Underwater Scooter",
                    "category": "AUXILIARY_RENTAL",
                    "quantity": 1,
                    "amount": p,
                    "price": int(round(p * 100)),
                    "formatted": f"€{p:.2f}",
                }
            )
        if (
            eq.get("stage_tank")
            and eq.get("stage_tank") != "None"
            and items_pricing.get("stage_tank")
        ):
            p = float(items_pricing["stage_tank"])
            aux_rental_items.append(
                {
                    "id": "stage_cylinder",
                    "title": f"Stage Cylinder ({eq.get('stage_tank')})",
                    "category": "AUXILIARY_RENTAL",
                    "quantity": 1,
                    "amount": p,
                    "price": int(round(p * 100)),
                    "formatted": f"€{p:.2f}",
                }
            )
        if (
            eq.get("hood_size")
            and eq.get("hood_size") != "None"
            and items_pricing.get("hood")
        ):
            p = float(items_pricing["hood"])
            aux_rental_items.append(
                {
                    "id": "rental_hood",
                    "title": f"Rental Thermal Hood ({eq.get('hood_size')})",
                    "category": "AUXILIARY_RENTAL",
                    "quantity": 1,
                    "amount": p,
                    "price": int(round(p * 100)),
                    "formatted": f"€{p:.2f}",
                }
            )
        if (
            eq.get("gloves_size")
            and eq.get("gloves_size") != "None"
            and items_pricing.get("gloves")
        ):
            p = float(items_pricing["gloves"])
            aux_rental_items.append(
                {
                    "id": "rental_gloves",
                    "title": f"Rental Dive Gloves ({eq.get('gloves_size')})",
                    "category": "AUXILIARY_RENTAL",
                    "quantity": 1,
                    "amount": p,
                    "price": int(round(p * 100)),
                    "formatted": f"€{p:.2f}",
                }
            )
        if (
            (eq.get("rental_smb") or (eq.get("has_own_smb") is False and eq.get("rental_smb") is not False))
            and items_pricing.get("smb")
        ):
            p = float(items_pricing["smb"])
            aux_rental_items.append(
                {
                    "id": "rental_smb",
                    "title": "Rental Surface Marker Buoy (SMB) & Spool",
                    "category": "AUXILIARY_RENTAL",
                    "quantity": 1,
                    "amount": p,
                    "price": int(round(p * 100)),
                    "formatted": f"€{p:.2f}",
                }
            )

        ins_price = (
            float(getattr(center_settings, "daily_insurance_price", 0.0) or 0.0)
            if center_settings
            else 0.0
        )
        if eq.get("insurance_type") == "CENTER" and ins_price > 0:
            aux_rental_items.append(
                {
                    "id": "daily_insurance",
                    "title": "Diving Center Daily Dive Accident Insurance",
                    "category": "INSURANCE",
                    "quantity": 1,
                    "amount": ins_price,
                    "price": int(round(ins_price * 100)),
                    "formatted": f"€{ins_price:.2f}",
                }
            )

        core_sum = sum(item["amount"] for item in core_rental_items)
        aux_sum = sum(item["amount"] for item in aux_rental_items)

        if core_sum >= full_pkg_rate and full_pkg_rate > 0:
            effective_core = full_pkg_rate
            savings = round(core_sum - full_pkg_rate, 2)
            package_cap = {
                "applied": True,
                "title": "Full Equipment Rental Package Cap Applied",
                "capPrice": int(round(full_pkg_rate * 100)),
                "savings": int(round(savings * 100)),
                "formattedSavings": f"€{savings:.2f}",
            }
        else:
            effective_core = core_sum
            package_cap = {
                "applied": False,
                "title": "No Package Cap",
                "capPrice": int(round(full_pkg_rate * 100)),
                "savings": 0,
                "formattedSavings": "€0.00",
            }

        total_rental = effective_core + aux_sum
        total_due = base_retail + total_rental
        all_rental_items = core_rental_items + aux_rental_items

    all_line_items = [base_line_item] + all_rental_items

    return {
        "pricing": {
            "original": int(round(total_due * 100)),
            "retail": int(round(total_due * 100)),
            "net": int(round(total_due * 100)),
            "currency": currency,
            "currencyPrecision": 2,
            "amount": round(total_due, 2),
            "formatted": f"€{total_due:.2f}",
        },
        "base_trip_price": round(base_retail, 2),
        "total_rental_surcharge": round(total_rental, 2),
        "total_due": round(total_due, 2),
        "line_items": all_line_items,
        "package_cap": package_cap,
    }
