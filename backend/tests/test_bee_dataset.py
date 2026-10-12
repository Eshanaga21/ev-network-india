"""Import invariants and full-dataset trip safety; no live provider requests."""

import json

import pytest

from backend import engine
from backend.ingestion import MAX_RECORDS, normalize
from backend.models import GraphSettings
from backend.tests.test_door_to_door import RoadProvider
from backend.vehicles import compatibility, permitted
from scripts.import_bee_dataset import connector_types


def test_bee_connector_mapping_keeps_ambiguous_labels():
    assert connector_types("CCS-II | Type-II AC") == "CCS2;Type2"
    assert connector_types("Combo (CCS-II + CHAdeMo + Type II)") == "CCS2;CHAdeMO;Type2"
    assert connector_types("CCS | Bharat AC-001") == "CCS;Bharat AC-001"
    assert connector_types("LEV DC Charge Point (IS-17017-2-7)") == "LEV DC"
    assert connector_types("Not specified") == "Not specified"


@pytest.mark.parametrize("connector", ["LEV AC", "LEV DC", "LEV AC;LEV DC"])
def test_light_ev_only_does_not_become_conditional_car_charging(connector):
    profile = {"connector_types": ["CCS2"], "connector_coverage_complete": False}
    station = {"connector_type": connector}
    assert compatibility(profile, station)["status"] == "incompatible"
    assert not permitted(profile, station, allow_unknown=True)
    assert compatibility(profile, {"connector_type": connector + ";CCS2"})["status"] == "compatible"
    assert compatibility(profile, {"connector_type": connector + ";CCS"})["status"] == "unknown"


def test_full_dataset_browsing_and_road_trip_do_not_build_quadratic_graph(client, monkeypatch):
    records = [
        {
            "station_id": f"large-test-{i}",
            "station_name": "Test-only location",
            "latitude": 28.61,
            "longitude": 77.21,
            "state": "Delhi",
        }
        for i in range(engine.MAX_GRAPH_RECORDS + 1)
    ]
    dataset = normalize(json.dumps(records).encode(), "test-only.json")
    client.app.state.store.save(dataset, json.dumps(records).encode())
    assert len(client.get("/api/dataset").json()["stations"]) == len(records)

    def forbidden(*args, **kwargs):
        raise AssertionError("Full-dataset road planning must not allocate a distance matrix")

    monkeypatch.setattr(engine, "distances", forbidden)
    monkeypatch.setattr("backend.main.get_provider", lambda: RoadProvider(km=1))
    body = {
        "origin": {"latitude": 28.61, "longitude": 77.21},
        "destination": {"latitude": 28.62, "longitude": 77.22},
        "ev_profile": {
            "custom": {
                "name": "Test-only EV",
                "battery_capacity_kwh": 50,
                "connector_types": ["CCS2"],
            }
        },
    }
    response = client.post("/api/trip", json=body)
    assert response.status_code == 200
    assert response.json()["route_mode"] == "road"
    assert response.json()["audit"]["regional_records"] == len(records)
    # Exact graph work fails before allocating, rather than silently truncating.
    response = client.post("/api/analysis", json={})
    assert response.status_code == 422 and "2,000" in response.json()["detail"]
    monkeypatch.setattr("backend.main.get_provider", lambda: None)
    assert client.post("/api/trip", json=body).status_code == 422


def test_import_limit_still_rejects_oversized_datasets():
    with pytest.raises(ValueError, match="Local import limit"):
        normalize(json.dumps([{}] * (MAX_RECORDS + 1)).encode(), "test-only.json")


def test_graph_limit_is_separate_from_import_capacity():
    assert MAX_RECORDS > engine.MAX_GRAPH_RECORDS
    with pytest.raises(ValueError, match="Choose a city"):
        engine.build_graph([{}] * (engine.MAX_GRAPH_RECORDS + 1), GraphSettings())
