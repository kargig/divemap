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


def resolve_package_items(pricing_config: dict[str, Any] | None) -> set[str]:
    """Return center package_items, falling back to defaults when missing or empty."""
    if not pricing_config or "package_items" not in pricing_config:
        return set(DEFAULT_PACKAGE_ITEMS)
    raw = pricing_config.get("package_items") or []
    if not raw:
        return set(DEFAULT_PACKAGE_ITEMS)
    return set(raw)


def _offered_price(
    items_pricing: dict[str, Any],
    key: str,
    default: float,
    *,
    requested: bool,
) -> float | None:
    """
    Return a billable price (>= 0) for a rental item.
    If the center marked the item not offered (price < 0) and it was requested, raise.
    If not requested and not offered, return None (skip silently).
    """
    raw = items_pricing.get(key, default)
    p = float(raw if raw is not None else default)
    if p < 0:
        if requested:
            raise ValueError(
                f"Rental item '{key}' is not offered by this diving center."
            )
        return None
    return p


def _is_accessory_rent(eq: dict[str, Any], option_key: str, rental_flag: str) -> bool:
    """True when 3-way option is RENT (or legacy rental flag with no OWN/NONE)."""
    option = eq.get(option_key)
    if option in ("NONE", "OWN"):
        return False
    if option == "RENT":
        return True
    # Legacy: rental flag set and option unset
    return bool(eq.get(rental_flag)) and option is None


def _is_sized_accessory_rent(
    eq: dict[str, Any], option_key: str, size_key: str
) -> bool:
    """True when hood/gloves should be billed as rental."""
    option = eq.get(option_key)
    if option in ("NONE", "OWN"):
        return False
    if option == "RENT":
        return True
    size = eq.get(size_key)
    return bool(size) and size != "None" and option is None


def compute_participant_octo_pricing(
    center_settings: DivingCenterBookingSettings | None,
    unit: OctoUnit | None,
    equipment_sizing: dict[str, Any] | None,
    currency: str = "EUR",
    *,
    selected_tank_id: str | None = None,
    selected_gas_mix_id: str | None = None,
) -> dict[str, Any]:
    """
    Computes OCTO-compliant pricing object, line items breakdown, and package caps for a diver.
    Conforms to the OCTO Travel API specification for octo/pricing capability.
    Dynamically respects center package_items bundling, tank upgrades, and gas surcharges.

    selected_tank_id / selected_gas_mix_id override values inside equipment_sizing when
    provided (callers typically store these on unit-item columns, not in sizing JSON).
    """
    eq = dict(equipment_sizing or {})
    if selected_tank_id is not None:
        eq["selected_tank_id"] = selected_tank_id
    if selected_gas_mix_id is not None:
        eq["selected_gas_mix_id"] = selected_gas_mix_id

    pricing_config = (
        center_settings.rental_equipment_pricing if center_settings else None
    )
    items_pricing = pricing_config.get("items", {}) if pricing_config else {}
    full_pkg_rate = (
        float(pricing_config.get("full_kit_package", 30.0)) if pricing_config else 30.0
    )
    package_items = resolve_package_items(pricing_config)

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

    def _append_rental(
        item_key: str,
        line_id: str,
        title: str,
        price_key: str,
        default_price: float,
        *,
        requested: bool,
    ) -> None:
        if not requested:
            return
        p = _offered_price(items_pricing, price_key, default_price, requested=True)
        if p is None:
            return
        candidate_rentals.append(
            (
                item_key,
                {
                    "id": line_id,
                    "title": title,
                    "quantity": 1,
                    "amount": p,
                    "price": int(round(p * 100)),
                    "formatted": f"€{p:.2f}",
                },
            )
        )

    # 1. Wetsuit
    _append_rental(
        "wetsuit",
        "rental_wetsuit",
        f"Rental Wetsuit ({eq.get('wetsuit_size')})",
        "wetsuit",
        10.0,
        requested=bool(eq.get("wetsuit_size") and eq.get("wetsuit_size") != "None"),
    )

    # 2. BCD
    _append_rental(
        "bcd",
        "rental_bcd",
        f"Rental BCD ({eq.get('bcd_size')})",
        "bcd",
        10.0,
        requested=bool(eq.get("bcd_size") and eq.get("bcd_size") != "None"),
    )

    # 3. Regulator Set
    reg_requested = bool(
        eq.get("rental_regulator")
        or (
            eq.get("has_own_regulator") is False
            and eq.get("rental_regulator") is not False
        )
    )
    fitting_label = (
        f" ({eq.get('regulator_fitting', 'DIN')})"
        if eq.get("regulator_fitting")
        else ""
    )
    _append_rental(
        "regulator",
        "rental_regulator",
        f"Rental Regulator Set{fitting_label}",
        "regulator",
        10.0,
        requested=reg_requested,
    )

    # 4. Fins & Booties
    fins_requested = bool(
        eq.get("rental_fins") or (eq.get("fin_size") and eq.get("fin_size") != "None")
    )
    boots_only = bool(
        not fins_requested
        and (
            eq.get("rental_boots")
            or (eq.get("boot_size") and eq.get("boot_size") != "None")
        )
    )
    if fins_requested:
        _append_rental(
            "fins_boots",
            "rental_fins",
            f"Rental Fins ({eq.get('fin_size', 'Standard')})",
            "fins_boots",
            8.0,
            requested=True,
        )
    elif boots_only:
        boot_label = eq.get("boot_size", eq.get("shoe_size_eu", "43"))
        _append_rental(
            "fins_boots",
            "rental_boots",
            f"Rental Booties (EU {boot_label})",
            "fins_boots",
            5.0,
            requested=True,
        )

    # 5. Mask & Snorkel
    mask_price_key = (
        "mask"
        if "mask_snorkel" not in items_pricing and "mask" in items_pricing
        else "mask_snorkel"
    )
    _append_rental(
        "mask_snorkel",
        "rental_mask",
        "Rental Mask",
        mask_price_key,
        5.0,
        requested=bool(eq.get("rental_mask")),
    )

    # 6. Dive Computer (Wrist Unit)
    _append_rental(
        "dive_computer",
        "rental_computer",
        "Rental Dive Computer (Wrist Unit)",
        "dive_computer",
        10.0,
        requested=bool(eq.get("rental_dive_computer")),
    )

    # 7. Torch — exclude OWN / NONE
    _append_rental(
        "dive_torch",
        "rental_torch",
        "Rental Primary Dive Torch",
        "dive_torch",
        8.0,
        requested=_is_accessory_rent(eq, "torch_option", "rental_torch"),
    )

    # 8. Hood
    hood_rent = _is_sized_accessory_rent(eq, "hood_option", "hood_size")
    _append_rental(
        "hood",
        "rental_hood",
        f"Rental Thermal Hood ({eq.get('hood_size') or 'M'})",
        "hood",
        5.0,
        requested=hood_rent,
    )

    # 9. Gloves
    gloves_rent = _is_sized_accessory_rent(eq, "gloves_option", "gloves_size")
    _append_rental(
        "gloves",
        "rental_gloves",
        f"Rental Dive Gloves ({eq.get('gloves_size') or 'M'})",
        "gloves",
        5.0,
        requested=gloves_rent,
    )

    # 10. SMB & Spool — exclude OWN / NONE
    _append_rental(
        "smb",
        "rental_smb",
        "Rental Surface Marker Buoy (SMB) & Spool",
        "smb",
        5.0,
        requested=_is_accessory_rent(eq, "smb_option", "rental_smb"),
    )

    # 11. DPV Underwater Scooter
    _append_rental(
        "dpv_scooter",
        "rental_scooter",
        "DPV Underwater Scooter",
        "dpv_scooter",
        40.0,
        requested=bool(eq.get("rental_scooter")),
    )

    # 12. Stage Cylinder
    _append_rental(
        "stage_tank",
        "stage_cylinder",
        f"Stage Cylinder ({eq.get('stage_tank')})",
        "stage_tank",
        20.0,
        requested=bool(eq.get("stage_tank") and eq.get("stage_tank") != "None"),
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
    tank_id = str(eq.get("selected_tank_id") or "12")
    tank_fee = float(tank_surcharges.get(tank_id, 0.0) or 0.0)
    if tank_fee < 0:
        raise ValueError(
            f"Selected cylinder '{tank_id}' is not offered by this diving center."
        )
    if tank_fee > 0:
        t_label = TANK_LABELS.get(tank_id, f"{tank_id}L Cylinder")
        upgrade_items.append(
            {
                "id": f"tank_upgrade_{tank_id}",
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
    gas_id = str(eq.get("selected_gas_mix_id") or "air").lower()
    gas_fee = float(gas_surcharges.get(gas_id, 0.0) or 0.0)
    if gas_fee < 0:
        raise ValueError(
            f"Selected breathing gas '{gas_id}' is not offered by this diving center."
        )
    if gas_fee > 0:
        g_label = GAS_LABELS.get(gas_id, f"Gas: {gas_id.upper()}")
        upgrade_items.append(
            {
                "id": f"gas_upgrade_{gas_id}",
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
