from unittest.mock import MagicMock, patch

from app.geo_utils import perform_reverse_geocode, search_places


def test_perform_reverse_geocode_geoapify_success():
    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.json.return_value = {
        "features": [
            {
                "properties": {
                    "country": "Greece",
                    "state": "Attica Regional Unit",
                    "city": "Glyfada",
                }
            }
        ]
    }

    with patch("os.getenv", return_value="fake_geoapify_key"):
        with patch("requests.get", return_value=mock_resp):
            res = perform_reverse_geocode(37.88, 23.75)
            assert res is not None
            assert res["country"] == "Greece"
            assert res["region"] == "Attica"
            assert res["city"] == "Glyfada"


def test_perform_reverse_geocode_photon_fallback():
    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.json.return_value = {
        "features": [
            {
                "properties": {
                    "country": "Egypt",
                    "state": "South Sinai",
                    "city": "Sharm El Sheikh",
                }
            }
        ]
    }

    with patch("os.getenv", return_value=None):  # No Geoapify key
        with patch("requests.get", return_value=mock_resp):
            res = perform_reverse_geocode(27.73, 34.25)
            assert res is not None
            assert res["country"] == "Egypt"
            assert res["region"] == "South Sinai"
            assert res["city"] == "Sharm El Sheikh"


def test_search_places_geoapify_success():
    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.json.return_value = {
        "features": [
            {
                "properties": {
                    "name": "Sydney",
                    "formatted": "Sydney, NSW, Australia",
                    "country": "Australia",
                    "result_type": "city",
                },
                "geometry": {
                    "coordinates": [151.208, -33.869],
                },
            }
        ]
    }

    with patch("os.getenv", return_value="fake_key"):
        with patch("requests.get", return_value=mock_resp):
            results = search_places("Sydney")
            assert len(results) == 1
            assert results[0]["name"] == "Sydney"
            assert results[0]["country"] == "Australia"
            assert results[0]["latitude"] == -33.869
            assert results[0]["longitude"] == 151.208


def test_search_places_photon_fallback():
    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.json.return_value = {
        "features": [
            {
                "properties": {
                    "name": "Ras Mohammed Wall",
                    "city": "Sharm El Sheikh",
                    "state": "South Sinai",
                    "country": "Egypt",
                },
                "geometry": {
                    "coordinates": [34.259, 27.732],
                },
            }
        ]
    }

    with patch("os.getenv", return_value=None):
        with patch("requests.get", return_value=mock_resp):
            results = search_places("Ras Mohammed")
            assert len(results) == 1
            assert results[0]["name"] == "Ras Mohammed Wall"
            assert results[0]["country"] == "Egypt"
            assert results[0]["latitude"] == 27.732
            assert results[0]["longitude"] == 34.259
