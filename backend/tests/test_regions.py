import json

from backend.regions import REGIONS, canonical_state, regional_dataset


def test_aliases_and_no_unknown_state_inference():
    assert canonical_state(" UP ") == "Uttar Pradesh"
    assert canonical_state("MP") == "Madhya Pradesh"
    assert canonical_state("NCT of Delhi") == "Delhi"
    assert canonical_state(None) is None
    assert canonical_state("Kerala") is None


def test_regional_api_and_snapshot_preservation(client, records):
    records[0]["state"] = "UP"
    records[1]["state"] = "Delhi"
    records[2]["state"] = "Tamil Nadu"
    records[3]["state"] = None
    preview = client.post(
        "/api/import/preview",
        files={"file": ("source.json", json.dumps(records), "application/json")},
    ).json()
    client.post("/api/import/commit", json={"preview_id": preview["preview_id"]})
    original = client.app.state.store.load()
    dataset = client.get("/api/dataset").json()
    assert len(original["stations"]) == 4
    assert len(dataset["stations"]) == 2
    assert dataset["metadata"]["regional_counts"]["Rajasthan"] == 0
    assert dataset["metadata"]["outside_scope_records"] == 2
    assert original["stations"][0]["state"] == "UP"
    assert dataset["stations"][0]["state"] == "Uttar Pradesh"
    assert dataset["stations"][0]["source_state"] == "UP"
    all_nodes = client.post("/api/analysis", json={}).json()
    assert all_nodes["summary"]["nodes"] == 2
    assert all_nodes["audit"]["regional_scope"] == list(REGIONS)
    assert client.post("/api/analysis", json={"state": "Tamil Nadu"}).json()["stations"] == []
    assert len(client.post("/api/analysis", json={"state": "UP"}).json()["stations"]) == 1
    assert (
        client.post(
            "/api/route", json={"origin": {"station_id": "0"}, "destination": {"station_id": "2"}}
        ).status_code
        == 422
    )
    assert client.app.state.store.load() == original


def test_scoped_capabilities_do_not_use_excluded_fields(client, records):
    records[0].update(state="Kerala", charging_power_kw=50)
    preview = client.post(
        "/api/import/preview",
        files={"file": ("data.json", json.dumps(records), "application/json")},
    ).json()
    client.post("/api/import/commit", json={"preview_id": preview["preview_id"]})
    data = client.get("/api/dataset").json()
    assert data["metadata"]["source_capabilities"]["charging_power_kw"]
    assert not data["metadata"]["capabilities"]["charging_power_kw"]
    assert regional_dataset(client.app.state.store.load())["metadata"]["regional_records"] == 3
