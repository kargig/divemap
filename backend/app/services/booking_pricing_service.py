from typing import Any

from app.models import DivingCenterBookingSettings, OctoUnit

DEFAULT_PACKAGE_ITEMS = [
    "regulator",
    "bcd",
    "wetsuit",
    "fins_boots",
    "mask_snorkel",
]

TANK_LABELS = {
    "12": "12L Steel (Standard)",
    "15": "15L Steel",
    "10": "10L Steel",
    "al80": "AL80 (11L Alu)",
    "twinset": "Twinset (2x12L)",
}

GAS_LABELS = {
    "air": "Air (21% O2)",
    "ean32": "Enriched Air Nitrox (EAN32)",
    "ean36": "Enriched Air Nitrox (EAN36)",
    "custom": "Custom Blend / O2",
}


def compute_participant_octo_pricing(
    center_settings: DivingCenterBookingSettings | None,
    unit: OctoUnit | None,
    equipment_sizing: dict[str, Any] | None,
    currency: str = "EUR",
) -> dict[str, Any]:
    """
    Computes OCTO-compliant pricing object, line items breakdown, and package caps for a diver.
    Conforms to the OCTO Travel API specification for octo/pricing capability.
    Dynamically respects center package_items bundling, tank upgrades, and gas surcharges.
    """
    eq = equipment_sizing or {}
    pricing_config = (
        center_settings.rental_equipment_pricing if center_settings else None
    )
    items_pricing = pricing_config.get("items", {}) if pricing_config else {}
    full_pkg_rate = (
        float(pricing_config.get("full_kit_package", 30.0)) if pricing_config else 30.0
    )
    package_items = set(
        pricing_config.get("package_items")
        if pricing_config and "package_items" in pricing_config
        else DEFAULT_PACKAGE_ITEMS
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

    # Gather all equipment items that the diver wants to rent
    candidate_rentals: list[tuple[str, dict[str, Any]]] = []

    # 1. Wetsuit
    if eq.get("wetsuit_size") and eq.get("wetsuit_size") != "None":
        p = float(items_pricing.get("wetsuit", 10.0))
        if p >= 0:
            candidate_rentals.append(
                (
                    "wetsuit",
                    {
                        "id": "rental_wetsuit",
                        "title": f"Rental Wetsuit ({eq.get('wetsuit_size')})",
                        "quantity": 1,
                        "amount": p,
                        "price": int(round(p * 100)),
                        "formatted": f"€{p:.2f}",
                    },
                )
            )

    # 2. BCD
    if eq.get("bcd_size") and eq.get("bcd_size") != "None":
        p = float(items_pricing.get("bcd", 10.0))
        if p >= 0:
            candidate_rentals.append(
                (
                    "bcd",
                    {
                        "id": "rental_bcd",
                        "title": f"Rental BCD ({eq.get('bcd_size')})",
                        "quantity": 1,
                        "amount": p,
                        "price": int(round(p * 100)),
                        "formatted": f"€{p:.2f}",
                    },
                )
            )

    # 3. Regulator Set
    if eq.get("rental_regulator") or (
        eq.get("has_own_regulator") is False and eq.get("rental_regulator") is not False
    ):
        p = float(items_pricing.get("regulator", 10.0))
        if p >= 0:
            fitting_label = (
                f" ({eq.get('regulator_fitting', 'DIN')})"
                if eq.get("regulator_fitting")
                else ""
            )
            candidate_rentals.append(
                (
                    "regulator",
                    {
                        "id": "rental_regulator",
                        "title": f"Rental Regulator Set{fitting_label}",
                        "quantity": 1,
                        "amount": p,
                        "price": int(round(p * 100)),
                        "formatted": f"€{p:.2f}",
                    },
                )
            )

    # 4. Fins & Booties
    if eq.get("rental_fins") or (eq.get("fin_size") and eq.get("fin_size") != "None"):
        p = float(items_pricing.get("fins_boots", 8.0))
        if p >= 0:
            candidate_rentals.append(
                (
                    "fins_boots",
                    {
                        "id": "rental_fins",
                        "title": f"Rental Fins ({eq.get('fin_size', 'Standard')})",
                        "quantity": 1,
                        "amount": p,
                        "price": int(round(p * 100)),
                        "formatted": f"€{p:.2f}",
                    },
                )
            )
    elif eq.get("rental_boots") or (
        eq.get("boot_size") and eq.get("boot_size") != "None"
    ):
        p = 5.0
        candidate_rentals.append(
            (
                "fins_boots",
                {
                    "id": "rental_boots",
                    "title": f"Rental Booties (EU {eq.get('boot_size', eq.get('shoe_size_eu', '43'))})",
                    "quantity": 1,
                    "amount": p,
                    "price": int(round(p * 100)),
                    "formatted": f"€{p:.2f}",
                },
            )
        )

    # 5. Mask & Snorkel
    if eq.get("rental_mask"):
        p = float(items_pricing.get("mask_snorkel", items_pricing.get("mask", 5.0)))
        if p >= 0:
            candidate_rentals.append(
                (
                    "mask_snorkel",
                    {
                        "id": "rental_mask",
                        "title": "Rental Mask",
                        "quantity": 1,
                        "amount": p,
                        "price": int(round(p * 100)),
                        "formatted": f"€{p:.2f}",
                    },
                )
            )

    # 6. Dive Computer (Wrist Unit)
    if eq.get("rental_dive_computer"):
        p = float(items_pricing.get("dive_computer", 10.0))
        if p >= 0:
            candidate_rentals.append(
                (
                    "dive_computer",
                    {
                        "id": "rental_computer",
                        "title": "Rental Dive Computer (Wrist Unit)",
                        "quantity": 1,
                        "amount": p,
                        "price": int(round(p * 100)),
                        "formatted": f"€{p:.2f}",
                    },
                )
            )

    # 7. Torch
    if (eq.get("rental_torch") or eq.get("torch_option") == "RENT") and eq.get(
        "torch_option"
    ) != "NONE":
        p = float(items_pricing.get("dive_torch", 8.0))
        if p >= 0:
            candidate_rentals.append(
                (
                    "dive_torch",
                    {
                        "id": "rental_torch",
                        "title": "Rental Primary Dive Torch",
                        "quantity": 1,
                        "amount": p,
                        "price": int(round(p * 100)),
                        "formatted": f"€{p:.2f}",
                    },
                )
            )

    # 8. Hood
    if (
        eq.get("hood_option") == "RENT"
        or (eq.get("hood_size") and eq.get("hood_size") != "None")
    ) and eq.get("hood_option") not in ("NONE", "OWN"):
        hood_size_label = eq.get("hood_size") or "M"
        p = float(items_pricing.get("hood", 5.0))
        if p >= 0:
            candidate_rentals.append(
                (
                    "hood",
                    {
                        "id": "rental_hood",
                        "title": f"Rental Thermal Hood ({hood_size_label})",
                        "quantity": 1,
                        "amount": p,
                        "price": int(round(p * 100)),
                        "formatted": f"€{p:.2f}",
                    },
                )
            )

    # 9. Gloves
    if (
        eq.get("gloves_option") == "RENT"
        or (eq.get("gloves_size") and eq.get("gloves_size") != "None")
    ) and eq.get("gloves_option") not in ("NONE", "OWN"):
        gloves_size_label = eq.get("gloves_size") or "M"
        p = float(items_pricing.get("gloves", 5.0))
        if p >= 0:
            candidate_rentals.append(
                (
                    "gloves",
                    {
                        "id": "rental_gloves",
                        "title": f"Rental Dive Gloves ({gloves_size_label})",
                        "quantity": 1,
                        "amount": p,
                        "price": int(round(p * 100)),
                        "formatted": f"€{p:.2f}",
                    },
                )
            )

    # 10. SMB & Spool
    if (eq.get("rental_smb") or eq.get("smb_option") == "RENT") and eq.get(
        "smb_option"
    ) != "NONE":
        p = float(items_pricing.get("smb", 5.0))
        if p >= 0:
            candidate_rentals.append(
                (
                    "smb",
                    {
                        "id": "rental_smb",
                        "title": "Rental Surface Marker Buoy (SMB) & Spool",
                        "quantity": 1,
                        "amount": p,
                        "price": int(round(p * 100)),
                        "formatted": f"€{p:.2f}",
                    },
                )
            )

    # 11. DPV Underwater Scooter
    if eq.get("rental_scooter"):
        p = float(items_pricing.get("dpv_scooter", 40.0))
        if p >= 0:
            candidate_rentals.append(
                (
                    "dpv_scooter",
                    {
                        "id": "rental_scooter",
                        "title": "DPV Underwater Scooter",
                        "quantity": 1,
                        "amount": p,
                        "price": int(round(p * 100)),
                        "formatted": f"€{p:.2f}",
                    },
                )
            )

    # 12. Stage Cylinder
    if eq.get("stage_tank") and eq.get("stage_tank") != "None":
        p = float(items_pricing.get("stage_tank", 20.0))
        if p >= 0:
            candidate_rentals.append(
                (
                    "stage_tank",
                    {
                        "id": "stage_cylinder",
                        "title": f"Stage Cylinder ({eq.get('stage_tank')})",
                        "quantity": 1,
                        "amount": p,
                        "price": int(round(p * 100)),
                        "formatted": f"€{p:.2f}",
                    },
                )
            )

    # Partition into core (package items) vs auxiliary (unbundled items)
    core_rental_items: list[dict[str, Any]] = []
    aux_rental_items: list[dict[str, Any]] = []

    for item_key, item_dict in candidate_rentals:
        if item_key in package_items:
            item_dict["category"] = "CORE_RENTAL"
            if not is_full_rental_unit:
                core_rental_items.append(item_dict)
            # If full rental tier, package items are covered by base retail
        else:
            item_dict["category"] = "AUXILIARY_RENTAL"
            aux_rental_items.append(item_dict)

    # 13. Cylinder Capacity Upgrades
    upgrade_items: list[dict[str, Any]] = []
    tank_surcharges = (
        pricing_config.get("tank_surcharges", {}) if pricing_config else {}
    )
    selected_tank_id = str(eq.get("selected_tank_id") or "12")
    tank_fee = float(tank_surcharges.get(selected_tank_id, 0.0) or 0.0)
    if tank_fee < 0:
        raise ValueError(
            f"Selected cylinder '{selected_tank_id}' is not offered by this diving center."
        )
    if tank_fee > 0:
        t_label = TANK_LABELS.get(selected_tank_id, f"{selected_tank_id}L Cylinder")
        upgrade_items.append(
            {
                "id": f"tank_upgrade_{selected_tank_id}",
                "title": f"Cylinder Upgrade: {t_label}",
                "category": "CYLINDER_UPGRADE",
                "quantity": 1,
                "amount": tank_fee,
                "price": int(round(tank_fee * 100)),
                "formatted": f"€{tank_fee:.2f}",
            }
        )

    # 14. Breathing Gas Mix Surcharges (e.g. EAN32 Nitrox)
    gas_surcharges = pricing_config.get("gas_surcharges", {}) if pricing_config else {}
    selected_gas_id = str(eq.get("selected_gas_mix_id") or "air").lower()
    gas_fee = float(gas_surcharges.get(selected_gas_id, 0.0) or 0.0)
    if gas_fee < 0:
        raise ValueError(
            f"Selected breathing gas '{selected_gas_id}' is not offered by this diving center."
        )
    if gas_fee > 0:
        g_label = GAS_LABELS.get(selected_gas_id, f"Gas: {selected_gas_id.upper()}")
        upgrade_items.append(
            {
                "id": f"gas_upgrade_{selected_gas_id}",
                "title": f"Breathing Gas: {g_label}",
                "category": "GAS_UPGRADE",
                "quantity": 1,
                "amount": gas_fee,
                "price": int(round(gas_fee * 100)),
                "formatted": f"€{gas_fee:.2f}",
            }
        )

    # 15. Daily Dive Insurance
    ins_price = (
        float(getattr(center_settings, "daily_insurance_price", 0.0) or 0.0)
        if center_settings
        else 0.0
    )
    if eq.get("insurance_type") == "CENTER" and ins_price > 0:
        upgrade_items.append(
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
    upgrades_sum = sum(item["amount"] for item in upgrade_items)

    if not is_full_rental_unit:
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
        all_rental_items = core_rental_items + aux_rental_items + upgrade_items
    else:
        effective_core = 0.0
        package_cap = {
            "applied": True,
            "title": "Full Equipment Rental Package Bundle",
            "capPrice": int(round(full_pkg_rate * 100)),
            "savings": 0,
            "formattedSavings": "€0.00",
        }
        all_rental_items = aux_rental_items + upgrade_items

    total_rental = effective_core + aux_sum + upgrades_sum
    total_due = base_retail + total_rental
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
        "full_pkg_rate": full_pkg_rate,
        "is_full_rental_unit": is_full_rental_unit,
    }
