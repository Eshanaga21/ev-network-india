import pytest


def test_all_analysis_and_comparison(loaded):
    for endpoint, body in [
        ("analysis", {}),
        ("route", {"origin": {"station_id": "0"}, "destination": {"station_id": "2"}}),
        ("resilience", {"station_id": "1"}),
        ("accessibility", {}),
        ("expansion", {}),
        ("clusters", {}),
        ("comparison", {"station_ids": ["0", "1"]}),
    ]:
        response = loaded.post(f"/api/{endpoint}", json=body)
        assert response.status_code == 200, response.text
        assert response.json()["audit"]["snapshot_id"]
        assert response.json()["audit"]["raw_sha256"]
    assert loaded.post("/api/comparison", json={"station_ids": ["0", "0"]}).status_code == 422
    assert loaded.post("/api/resilience", json={"station_id": "missing"}).status_code == 422
    assert loaded.post("/api/analysis", json={"state": "No such state"}).json()["stations"] == []


def test_scenario_reopen_duplicate_delete_reset(loaded):
    scenario = loaded.post(
        "/api/scenarios",
        json={
            "name": "Radius study",
            "settings": {"graph": {"radius_km": 12}, "weights": {"distance": 100}},
        },
    ).json()
    assert scenario["snapshot_id"] == loaded.get("/api/dataset").json()["metadata"]["snapshot_id"]
    duplicate = loaded.post(
        "/api/scenarios", json={"name": "Radius study copy", "settings": scenario["settings"]}
    ).json()
    loaded.delete("/api/dataset")
    assert loaded.post(f"/api/scenarios/{scenario['id']}/load").status_code == 200
    assert loaded.get("/api/dataset").json()["loaded"]
    loaded.delete(f"/api/scenarios/{duplicate['id']}")
    assert len(loaded.get("/api/scenarios").json()) == 1


def test_report_escape(loaded):
    response = loaded.post(
        "/api/report",
        json={
            "route": {"origin": {"station_id": "0"}, "destination": {"station_id": "2"}},
            "outage": {"station_id": "1"},
        },
    )
    assert response.status_code == 200
    assert "Modeled station outage" in response.text
    assert "raw_sha256" in response.text
    assert "No live occupancy" in response.text


@pytest.mark.parametrize(
    "settings",
    [{"radius_km": 0}, {"k": 0}, {"speed_kmh": -5}, {"method": "road"}, {"radius_km": "nan"}],
)
def test_invalid_graph_input(loaded, settings):
    assert loaded.post("/api/analysis", json={"graph": settings}).status_code == 422


def test_vehicle_input_and_no_valid_import(client, loaded):
    response = loaded.post(
        "/api/route",
        json={
            "origin": {"station_id": "0"},
            "destination": {"station_id": "1"},
            "vehicle": {"target_soc": 5, "reserve_soc": 10},
        },
    )
    assert response.status_code == 422
    preview = client.post(
        "/api/import/preview",
        files={
            "file": (
                "invalid.json",
                '[{"station_id":"x","station_name":"X","latitude":0,"longitude":0}]',
                "application/json",
            )
        },
    ).json()
    assert (
        client.post("/api/import/commit", json={"preview_id": preview["preview_id"]}).status_code
        == 422
    )


def test_road_provider(monkeypatch):
    from backend.providers import OSRMProvider, get_provider

    assert get_provider() is None

    class Response:
        def raise_for_status(self):
            return None

        def json(self):
            return {
                "code": "Ok",
                "routes": [
                    {
                        "distance": 1000,
                        "duration": 120,
                        "geometry": {"type": "LineString", "coordinates": [[77, 28], [77, 28.1]]},
                    }
                ],
            }

    monkeypatch.setattr("backend.providers.httpx.get", lambda *a, **k: Response())
    result = OSRMProvider("http://127.0.0.1:5000").route([(28, 77), (28.1, 77)])
    assert result["distance_km"] == 1
    assert result["duration_min"] == 2


def test_audit_records_algorithm_versions(loaded):
    result = loaded.post("/api/analysis", json={"search": "station"}).json()
    assert result["audit"]["application_version"] == "1.0.0"
    assert result["audit"]["algorithm_versions"]["networkx"]
    assert result["audit"]["filters"]["search"] == "station"


def test_report_escapes_untrusted_station_text(loaded):
    store = loaded.app.state.store
    dataset = store.load()
    dataset["stations"][0]["station_name"] = '<script>alert("source")</script>'
    store.save(dataset, b"reviewed source")
    response = loaded.post("/api/report", json={})
    assert response.status_code == 200
    assert '<script>alert("source")</script>' not in response.text
    assert "&lt;script&gt;" in response.text
