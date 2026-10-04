import json

from backend.ingestion import normalize


def test_derived_keys_are_opt_in_stable_and_deduplicate_exact_rows():
    row = {"name": "Source AC", "lattitude": 28, "longitude": 77, "state": "Delhi"}
    other = {**row, "name": "Source DC"}
    raw = json.dumps([row, row, other]).encode()
    assert not normalize(raw, "source.json")["stations"]
    result = normalize(raw, "source.json", generate_missing_ids=True)
    assert len(result["stations"]) == 2
    assert result["metadata"]["duplicate_source_rows_removed"] == 1
    assert result["metadata"]["derived_id_records"] == 2
    reversed_rows = normalize(
        json.dumps([other, row]).encode(), "source.json", generate_missing_ids=True
    )
    assert result["stations"][0]["station_id"] == reversed_rows["stations"][1]["station_id"]
    assert result["stations"][0]["station_id_origin"] == "derived record hash"


def test_csv_source_fields_preserved_without_interpreting_type_codes():
    raw = b"name,state,city,address,lattitude,longitude,type\nSource,Delhi,New Delhi,Observed address,28,77,12\nBad,Delhi,New Delhi,,,77,12\n"
    result = normalize(raw, "source.csv", generate_missing_ids=True)
    assert result["metadata"]["rejected_records"] == 1
    station = result["stations"][0]
    assert station["address"] == "Observed address"
    assert station["source_type"] == "12"
    assert station["connector_type"] is None
    assert station["charging_power_kw"] is None
    assert station["num_chargers"] is None
    assert station["availability"] is None


def test_source_ids_remain_source_ids_when_derivation_is_enabled():
    raw = b'[{"station_id":"publisher-id","name":"Source","latitude":28,"longitude":77}]'
    result = normalize(raw, "source.json", generate_missing_ids=True)
    assert result["stations"][0]["station_id"] == "publisher-id"
    assert result["stations"][0]["station_id_origin"] == "source"
    assert result["metadata"]["derived_id_records"] == 0


def test_import_api_reviews_and_commits_derived_identity(client):
    raw = b"name,state,city,lattitude,longitude\nSource,Delhi,New Delhi,28,77\n"
    response = client.post(
        "/api/import/preview",
        files={"file": ("source.csv", raw, "text/csv")},
        data={"generate_missing_ids": "true"},
    )
    assert response.status_code == 200
    preview = response.json()
    assert preview["metadata"]["derived_id_records"] == 1
    assert not client.get("/api/dataset").json()["loaded"]
    assert (
        client.post("/api/import/commit", json={"preview_id": preview["preview_id"]}).status_code
        == 200
    )
    assert (
        client.get("/api/dataset").json()["stations"][0]["station_id_origin"]
        == "derived record hash"
    )
