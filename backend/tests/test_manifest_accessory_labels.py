from app.services.manifest_export_service import format_accessory_checklist_labels


def test_own_hood_with_size_is_own_not_rent():
    labels = format_accessory_checklist_labels(
        {
            "hood_option": "OWN",
            "hood_size": "M",
            "gloves_option": "OWN",
            "gloves_size": "L",
            "has_own_dive_computer": True,
        }
    )
    assert any("Own Hood" == x for x in labels)
    assert any("Own Gloves" == x for x in labels)
    assert not any("Rent Hood" in x for x in labels)
    assert not any("Rent Gloves" in x for x in labels)


def test_own_torch_smb_with_stale_rental_flags_is_own():
    labels = format_accessory_checklist_labels(
        {
            "torch_option": "OWN",
            "rental_torch": True,
            "smb_option": "OWN",
            "rental_smb": True,
            "has_own_dive_computer": True,
        }
    )
    assert "Own Torch" in labels
    assert "Own SMB" in labels
    assert not any("Rent Torch" in x for x in labels)
    assert not any("Rent SMB" in x for x in labels)


def test_none_options_omit_torch_smb_hood():
    labels = format_accessory_checklist_labels(
        {
            "torch_option": "NONE",
            "rental_torch": True,
            "smb_option": "NONE",
            "hood_option": "NONE",
            "hood_size": "M",
            "has_own_dive_computer": True,
        }
    )
    assert not any("Torch" in x for x in labels)
    assert not any("SMB" in x for x in labels)
    assert not any("Hood" in x for x in labels)


def test_rent_options_show_rent_labels():
    labels = format_accessory_checklist_labels(
        {
            "torch_option": "RENT",
            "smb_option": "RENT",
            "hood_option": "RENT",
            "hood_size": "S",
            "gloves_option": "RENT",
            "gloves_size": "M",
            "rental_dive_computer": True,
        }
    )
    assert any("Rent Torch" in x for x in labels)
    assert any("Rent SMB" in x for x in labels)
    assert any("Rent Hood (S)" in x for x in labels)
    assert any("Rent Gloves (M)" in x for x in labels)
    assert any("Rent Computer" in x for x in labels)


def test_legacy_size_without_option_is_rent():
    labels = format_accessory_checklist_labels(
        {"hood_size": "L", "has_own_dive_computer": True}
    )
    assert any("Rent Hood (L)" in x for x in labels)
