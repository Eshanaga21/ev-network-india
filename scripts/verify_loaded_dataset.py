"""Read-only acceptance checks against the actual local snapshot (no fixture import)."""

import hashlib
import json
from pathlib import Path

from fastapi.testclient import TestClient

from backend.main import create_app
from backend.store import Store

ROOT = Path(__file__).resolve().parents[1]


def main():
    store = Store(ROOT / "data/local")
    dataset = store.load()
    assert dataset, "Import a real dataset through the UI first."
    metadata = dataset["metadata"]
    raw = (store.root / "snapshots" / metadata["snapshot_id"] / "source.raw").read_bytes()
    assert hashlib.sha256(raw).hexdigest() == metadata["raw_sha256"]
    stations = dataset["stations"]
    assert len(stations) == metadata["valid_records"]
    assert len({s["station_id"] for s in stations}) == len(stations)
    client = TestClient(create_app(store.root))
    context = {"graph": {"method": "radius", "radius_km": 25, "k": 3, "speed_kmh": 45}}

    def post(path, body):
        response = client.post(f"/api/{path}", json=body)
        assert response.status_code == 200, response.text
        return response.json()

    scoped = client.get("/api/dataset").json()
    assert len(scoped["stations"]) == 282
    assert scoped["metadata"]["regional_counts"] == {
        "Uttar Pradesh": 65,
        "Delhi": 102,
        "Rajasthan": 42,
        "Haryana": 49,
        "Punjab": 16,
        "Madhya Pradesh": 8,
    }
    by_row = {s["source_row"]: s["station_id"] for s in scoped["stations"]}
    origin, destination, isolated = by_row[2], by_row[24], by_row[25]
    graph = post("analysis", context)
    assert graph["summary"]["nodes"] == 282
    # Actual source rows: Galleria, Heritage City and Fairmont Jaipur.
    route_input = {
        **context,
        "origin": {"station_id": origin},
        "destination": {"station_id": destination},
        "vehicle": {"initial_soc": 10},
    }
    route = post("route", route_input)
    astar = post("route", {**route_input, "algorithm": "astar"})
    assert route["found"] and route["distance_km"] == astar["distance_km"]
    assert route["battery"]["stops"] == 1
    disconnected = post(
        "route",
        {**context, "origin": {"station_id": origin}, "destination": {"station_id": isolated}},
    )
    assert not disconnected["found"]
    outage_input = {"graph": {"radius_km": 2}, "station_id": destination}
    outage = post("resilience", outage_input)
    assert outage["after"]["nodes"] == outage["before"]["nodes"] - 1
    accessibility = post("accessibility", context)
    candidates = post("expansion", context)
    assert candidates == post("expansion", context)
    clusters = post("clusters", context)
    comparison = post("comparison", {**context, "station_ids": [isolated, origin, destination]})
    report = client.post(
        "/api/report", json={**context, "route": route_input, "outage": {"station_id": destination}}
    )
    assert report.status_code == 200 and "raw_sha256" in report.text
    assert store.load()["metadata"]["snapshot_id"] == metadata["snapshot_id"]
    target = ROOT / "docs/verification"
    target.mkdir(exist_ok=True)
    (target / "academic-report.html").write_text(report.text)
    (target / "loaded-dataset-verification.json").write_text(
        json.dumps(
            {
                "source": metadata,
                "regional_scope": scoped["metadata"],
                "checks": {
                    "raw_hash_matches": True,
                    "unique_validated_ids": True,
                    "Dijkstra_equals_Astar": True,
                    "no_path_verified": True,
                    "deterministic_candidates": True,
                    "snapshot_unchanged": True,
                },
                "graph_25km": graph["summary"],
                "route": route,
                "no_path": disconnected,
                "outage_2km": outage,
                "accessibility": accessibility,
                "expansion": candidates,
                "clustering": clusters,
                "comparison": comparison,
                "saved_scenarios": store.scenarios(),
            },
            indent=2,
            ensure_ascii=False,
        )
    )
    print(
        f"Verified {len(stations)} source records; snapshot {metadata['snapshot_id']}. Report and evidence saved to docs/verification."
    )


if __name__ == "__main__":
    main()
