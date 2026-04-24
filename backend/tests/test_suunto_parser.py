import pytest
import orjson
from app.routers.dives.imports.suunto_parser import parse_suunto_json_file

def test_parse_suunto_format_a():
    # Suunto D5 / EON Core style
    data = {
        "DeviceLog": {
            "Header": {
                "DateTime": "2025-11-26T11:22:12.080+05:00",
                "Duration": 3482,
                "Device": {"Name": "Suunto D5"},
                "Diving": {
                    "Algorithm": "Suunto Fused2 RGBM",
                    "EndTissue": {
                        "CNS": 0.05,
                        "OTU": 15
                    },
                    "Gases": [
                        {
                            "Oxygen": 0.32, 
                            "Helium": 0.10, 
                            "State": "Primary", 
                            "TankFillPressure": 20000000, 
                            "EndPressure": 5000000,
                            "TankSize": 0.012
                        }
                    ]
                }
            },
            "Samples": [
                {
                    "TimeISO8601": "2025-11-26T11:22:12.080+05:00",
                    "Depth": 0.0,
                    "Temperature": 302.75, # 29.6 C
                    "Ceiling": 0,
                    "NoDecTime": 6000,
                    "Ventilation": 0.0003
                },
                {
                    "TimeISO8601": "2025-11-26T11:22:32.080+05:00", # +20s
                    "Depth": 5.5,
                    "Temperature": 302.15, # 29.0 C
                    "Ceiling": 1.5,
                    "NoDecTime": 4500,
                    "Pressure": 18000000,
                    "TimeToSurface": 300
                }
            ]
        }
    }
    
    result = parse_suunto_json_file(orjson.dumps(data))
    
    assert result["dive_date"] == "2025-11-26"
    assert result["dive_time"] == "11:22:12"
    assert result["duration"] == 58
    assert result["model"] == "Suunto D5"
    assert result["o2_percent"] == 32
    assert result["he_percent"] == 10
    
    # Check cylinders
    assert len(result["cylinders"]) == 1
    cyl = result["cylinders"][0]
    assert cyl["suunto_index"] == 1 # EON/D5 is 1-indexed
    assert cyl["start"] == 200.0

    # Check profile data
    assert len(result["profile_data"]["samples"]) == 2
    s2 = result["profile_data"]["samples"][1]
    assert s2["time_minutes"] == pytest.approx(20/60, abs=1e-3)
    assert s2["depth"] == 5.5
    assert s2["tts_minutes"] == 5.0 # 300 / 60
    
    # Check dive information for summary fields
    assert "SAC: 18.0 l/min" in result["dive_information"]
    assert "CNS: 5%" in result["dive_information"]
    assert "OTU: 15" in result["dive_information"]
    assert "Max Depth: 5.5 m" in result["dive_information"]
    assert "Avg Depth: 2.75 m" in result["dive_information"]
    assert "Deco Model: Suunto Fused2 RGBM" in result["dive_information"]




def test_parse_suunto_format_b_ocean():
    # Suunto Ocean style (0-indexed gas, sparse depth from pressure)
    data = {
        "DeviceLog": {
            "Header": {
                "DateTime": "2026-01-13T11:05:31.170+05:00",
                "DiveTime": 3000,
                "Device": {"Name": "Suunto Ocean"},
                "SurfacePressure": 100000
            },
            "Samples": [
                {
                    "TimeISO8601": "2026-01-13T11:05:31.170+05:00",
                    "AbsPressure": 200000, # Should be ~10m depth
                    "Temperature": 300.15,
                    "Ventilation": 0.0003 # 0.0003 * 60000 = 18 L/min
                },
                {
                    "TimeISO8601": "2026-01-13T11:05:41.170+05:00",
                    "AbsPressure": 210000, # ~11m
                    # No temperature here, should carry forward
                    "DiveEvents": {"Alarm": {"Type": "Ascent Speed"}}
                }
            ]
        }
    }
    
    result = parse_suunto_json_file(orjson.dumps(data))
    
    assert result["model"] == "Suunto Ocean"
    assert result["profile_data"]["avg_sac"] == 18.0
    
    samples = result["profile_data"]["samples"]
    assert len(samples) == 2
    assert samples[0]["depth"] == pytest.approx(10.0)
    assert samples[1]["depth"] == pytest.approx(11.0)
    assert samples[1]["temperature"] == 27.0 # Carried from first sample
    
    # Check events
    events = result["profile_data"]["events"]
    assert any(e["type"] == "warning" and "Ascent Speed" in e["name"] for e in events)

def test_parse_suunto_gas_offset():
    # Verify EON is 1-indexed and Ocean is 0-indexed for GasSwitch events
    
    # EON (1-indexed)
    eon_data = {
        "DeviceLog": {
            "Header": {"Device": {"Name": "EON Core"}, "Diving": {"Gases": [{"Oxygen": 0.21}]}},
            "Samples": [{"Events": [{"GasSwitch": {"GasNumber": 1}}]}]
        }
    }
    eon_res = parse_suunto_json_file(orjson.dumps(eon_data))
    assert eon_res["profile_data"]["events"][0]["cylinder"] == "0" # 1 - 1 = 0

    # Ocean (0-indexed)
    ocean_data = {
        "DeviceLog": {
            "Header": {"Device": {"Name": "Ocean"}, "Diving": {"Gases": [{"Oxygen": 0.21}]}},
            "Samples": [{"DiveEvents": {"GasSwitch": {"GasNumber": 0}}}]
        }
    }
    ocean_res = parse_suunto_json_file(orjson.dumps(ocean_data))
    assert ocean_res["profile_data"]["events"][0]["cylinder"] == "0" # 0 - 0 = 0

def test_invalid_json():
    with pytest.raises(ValueError):
        parse_suunto_json_file(b"invalid json")
