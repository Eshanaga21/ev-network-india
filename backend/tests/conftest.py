import json

import pytest
from fastapi.testclient import TestClient

from backend.main import create_app


@pytest.fixture
def records():
    # Small synthetic input is isolated to tests, never imported by production code.
    return [
        {
            "station_id": str(i),
            "station_name": f"Test {i}",
            "latitude": lat,
            "longitude": lon,
            "city": "Test city",
            "state": "Delhi",
            "country": "India",
            "status": None,
            "availability": "1",
            "connector_type": None,
            "operator": None,
            "num_chargers": None,
            "charging_power_kw": None,
            "data_completeness_pct": 50,
        }
        for i, (lat, lon) in enumerate([(28, 77), (28.1, 77), (28.2, 77), (26.85, 80.95)])
    ]


@pytest.fixture
def client(tmp_path):
    with TestClient(create_app(tmp_path)) as client:
        yield client


@pytest.fixture
def loaded(client, records):
    preview = client.post(
        "/api/import/preview",
        files={"file": ("test.json", json.dumps(records), "application/json")},
    ).json()
    response = client.post("/api/import/commit", json={"preview_id": preview["preview_id"]})
    assert response.status_code == 200
    return client


@pytest.fixture(autouse=True)
def isolate_external_services(monkeypatch):
    monkeypatch.setenv("EV_OSRM_URL", "")
    monkeypatch.setenv("EV_GEOCODER_URL", "")
    monkeypatch.setenv("GEMINI_API_KEY", "")
    monkeypatch.setenv("GOOGLE_MAPS_API_KEY", "")
    monkeypatch.setenv("GOOGLE_MAPS_BROWSER_KEY", "")
