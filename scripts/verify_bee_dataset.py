"""Verify the active BEE snapshot and API without billing external route services."""

import hashlib
import json
from collections import Counter
from datetime import datetime
from pathlib import Path
from time import perf_counter
from unittest.mock import patch
from zoneinfo import ZoneInfo

from fastapi.testclient import TestClient

from backend.main import create_app
from backend.store import Store
from backend.vehicles import compatibility

ROOT = Path(__file__).resolve().parents[1]


class VerificationRoadProvider:
    """Explicit local test geometry; never represents a live road measurement."""

    def route(self, points):
        return {
            "provider": "Verification fixture — no live API request",
            "distance_km": 1,
            "duration_min": 2,
            "geometry": {"type": "LineString", "coordinates": [[lon, lat] for lat, lon in points]},
            "legs": [{"distance": 1000, "duration": 120}],
        }


def main():
    store = Store(ROOT / "data/local")
    saved = store.load()
    assert saved and saved["metadata"].get("bee_preparation"), "Activate the BEE snapshot first."
    meta = saved["metadata"]
    snapshot = store.root / "snapshots" / meta["snapshot_id"]
    assert hashlib.sha256((snapshot / "source.raw").read_bytes()).hexdigest() == meta["raw_sha256"]
    assert len({s["station_id"] for s in saved["stations"]}) == len(saved["stations"])
    client = TestClient(create_app(store.root))
    started = perf_counter()
    response = client.get("/api/dataset")
    assert response.status_code == 200
    dataset = response.json()
    stations = dataset["stations"]
    expected = {s: c["station_locations"] for s, c in meta["bee_preparation"]["by_state"].items()}
    assert len(stations) == meta["bee_preparation"]["station_locations"]
    assert dataset["metadata"]["regional_counts"] == expected
    assert all(s["availability"] is None and s["status"] is None for s in stations)
    assert all(s["tariff_inr_per_kwh"] is None for s in stations)
    assert all(s["charging_power_kw"] is None and s["num_chargers"] is None for s in stations)
    assert all(
        s["source_pdf_pages"] and s["station_id_origin"] == "derived location group"
        for s in stations
    )
    profile = {"connector_types": ["CCS2", "Type2"], "connector_coverage_complete": True}
    compatible = Counter(compatibility(profile, s)["status"] for s in stations)
    # Real active source, local provider transport, full regional station set.
    body = {
        "origin": {"latitude": 28.6129, "longitude": 77.2295},
        "destination": {"latitude": 28.62, "longitude": 77.24},
        "ev_profile": {
            "custom": {
                "name": "Verification car profile",
                "battery_capacity_kwh": 50,
                "connector_types": ["CCS2", "Type2"],
            }
        },
    }
    with (
        patch("backend.main.get_provider", return_value=VerificationRoadProvider()),
        patch(
            "backend.engine.distances",
            side_effect=AssertionError("No matrix needed for road trips"),
        ),
    ):
        trip = client.post("/api/trip", json=body)
    assert trip.status_code == 200, trip.text
    assert trip.json()["route_mode"] == "road" and trip.json()["found"]
    assert trip.json()["battery"]["feasible"] and trip.json()["audit"]["regional_records"] == len(
        stations
    )
    # Full-network academic calculation is explicitly bounded; a city subset works.
    bounded = client.post("/api/analysis", json={})
    assert bounded.status_code == 422 and "2,000" in bounded.json()["detail"]
    cities = Counter((s["state"], s["city"]) for s in stations if s["city"])
    state, city = next(key for key, count in cities.items() if 3 <= count <= 20)
    subset = client.post("/api/analysis", json={"state": state, "city": city})
    assert subset.status_code == 200, subset.text
    assert subset.json()["summary"]["nodes"] == cities[state, city]
    assert store.load()["metadata"]["snapshot_id"] == meta["snapshot_id"]
    activation = json.loads((ROOT / "docs/verification/bee-dataset-import.json").read_text())
    previous = activation["previous_snapshot_id"]
    assert not previous or (store.root / "snapshots" / previous / "dataset.json").is_file()
    report = {
        "checked_date": datetime.now(ZoneInfo("Asia/Calcutta")).date().isoformat(),
        "snapshot_id": meta["snapshot_id"],
        "previous_snapshot_preserved": previous,
        "source_name": meta["source_name"],
        "source_data_as_of": meta["source_data_as_of"],
        "source_csv_sha256": meta["raw_sha256"],
        "source_pdf_sha256": meta["source_pdf_sha256"],
        "active_station_locations": len(stations),
        "regional_counts": expected,
        "compatibility_for_complete_ccs2_type2_car_profile": dict(compatible),
        "checks": {
            "source_hash_matches": True,
            "unique_derived_location_ids": True,
            "all_six_state_counts_match_preparation": True,
            "source_connector_and_page_references_preserved": True,
            "unknown_live_availability_tariffs_and_power_preserved": True,
            "full_dataset_road_trip_without_distance_matrix": True,
            "academic_limit_before_matrix_allocation": True,
            "filtered_city_analysis": {
                "state": state,
                "city": city,
                "stations": cities[state, city],
            },
            "active_snapshot_unchanged_by_verification": True,
        },
        "verification_elapsed_seconds": round(perf_counter() - started, 3),
        "road_provider_check": "Local deterministic provider fixture; no live directions request or billable API call.",
    }
    target = ROOT / "docs/verification/bee-loaded-dataset-verification.json"
    target.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n")
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
