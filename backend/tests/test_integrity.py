import hashlib
import json
from pathlib import Path

import pytest

from backend.ingestion import FIELDS, normalize


def test_no_dataset(client):
    assert client.get("/api/dataset").json() == {"loaded": False, "metadata": None, "stations": []}
    assert client.post("/api/analysis", json={}).status_code == 409
    assert (
        client.post(
            "/api/route", json={"origin": {"station_id": "1"}, "destination": {"station_id": "2"}}
        ).status_code
        == 409
    )


def test_schema_contains_no_records(client):
    lines = client.get("/api/schema").text.strip().splitlines()
    assert len(lines) == 1
    assert lines[0].split(",") == FIELDS


def test_csv_mapping():
    raw = b"code,title,y,x\nA,Observed,28,77\n"
    result = normalize(
        raw,
        "station.csv",
        {"station_id": "code", "station_name": "title", "latitude": "y", "longitude": "x"},
    )
    assert result["stations"][0]["station_id"] == "A"
    assert result["stations"][0]["charging_power_kw"] is None
    assert result["stations"][0]["country"] is None
    assert result["metadata"]["raw_sha256"] == hashlib.sha256(raw).hexdigest()


def test_aliases_duplicates_invalid_missing():
    rows = [
        {"stationid": "1", "name": "Observed", "lattitude": 28, "longitude": 77},
        {"stationid": "1", "name": "Duplicate", "lattitude": 28, "longitude": 77},
        {"stationid": "2", "name": "Invalid", "lattitude": 100, "longitude": 77},
        {"stationid": None, "name": "No ID", "lattitude": 28, "longitude": 77},
        {"stationid": "3", "name": "Outside", "lattitude": 40, "longitude": -70},
    ]
    result = normalize(json.dumps(rows).encode(), "source.json")
    assert len(result["stations"]) == 1
    assert result["metadata"]["duplicate_ids_removed"] == 1
    assert result["metadata"]["rejected_records"] == 3
    assert not result["metadata"]["capabilities"]["num_chargers"]
    assert not result["metadata"]["capabilities"]["status"]


@pytest.mark.parametrize("lat,lon", [("nan", 77), (28, "Infinity"), (0, 0), (-10, 77), (28, 181)])
def test_bad_coordinates(lat, lon):
    result = normalize(
        json.dumps(
            [{"station_id": "A", "station_name": "A", "latitude": lat, "longitude": lon}]
        ).encode(),
        "data.json",
    )
    assert not result["stations"]


def test_partial_optional_fields(records):
    records[0]["num_chargers"] = 2
    records[1]["num_chargers"] = -2
    records[2]["charging_power_kw"] = "bad"
    result = normalize(json.dumps(records).encode(), "stations.json")
    assert result["metadata"]["capabilities"]["num_chargers"]
    assert result["stations"][1]["num_chargers"] is None
    assert len(result["metadata"]["warnings"]) == 2


def test_empty_bad_mapping_and_json():
    with pytest.raises(ValueError):
        normalize(b"[]", "stations.json")
    with pytest.raises(ValueError):
        normalize(b'{"a": 1}', "stations.json")
    with pytest.raises(ValueError):
        normalize(b'[{"id":"A"}]', "stations.json", {"station_id": "not_a_column"})


def test_immutable_snapshot_and_no_auto_fallback(loaded):
    dataset = loaded.get("/api/dataset").json()
    sid = dataset["metadata"]["snapshot_id"]
    root = loaded.app.state.store.root
    assert (root / "snapshots" / sid / "source.raw").is_file()
    before = (root / "snapshots" / sid / "dataset.json").read_bytes()
    loaded.delete("/api/dataset")
    assert not loaded.get("/api/dataset").json()["loaded"]
    assert (root / "snapshots" / sid / "dataset.json").read_bytes() == before
    assert loaded.post("/api/analysis", json={}).status_code == 409


def test_refresh_failure_no_substitution(client, monkeypatch):
    import httpx

    monkeypatch.setattr(
        httpx, "get", lambda *a, **k: (_ for _ in ()).throw(httpx.ConnectError("offline"))
    )
    assert client.post("/api/import/refresh").status_code == 502
    assert not client.get("/api/dataset").json()["loaded"]


def test_production_has_no_fixture_dependency():
    for path in Path("backend").glob("*.py"):
        text = path.read_text()
        assert "eamrit_india_charging_stations.json" not in text
        assert "backend.tests" not in text
        assert "random." not in text


def test_completeness_counts_only_observations():
    raw = b'[{"station_id":"observed","station_name":"Source","latitude":28,"longitude":77,"city":"Delhi","state":"Delhi"}]'
    result = normalize(raw, "source.json")
    assert result["stations"][0]["data_completeness_pct"] == 50
    assert result["stations"][0]["status"] is None
    assert result["stations"][0]["country"] is None
