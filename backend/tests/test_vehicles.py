"""Synthetic station/session fixtures; never claims real live charger specifications."""

import json

import pytest
from pydantic import ValidationError

from backend import engine
from backend.ingestion import normalize
from backend.models import CustomEV, EVSelection, GraphSettings, TripRequest, Vehicle
from backend.tests.test_door_to_door import RoadProvider
from backend.trips import road_trip
from backend.vehicles import catalog, charge_session, compatibility, resolve


def custom(capacity=50, connectors=None, dc=60, ac=7):
    return EVSelection(
        custom=CustomEV(
            name="Test-only EV",
            battery_capacity_kwh=capacity,
            connector_types=connectors or ["CCS2"],
            max_dc_charge_kw=dc,
            max_ac_charge_kw=ac,
        )
    )


def test_catalogue_variants_sources_and_missing_specs():
    data = catalog()["vehicles"]
    assert len(data) == 14 and len({v["id"] for v in data}) == 14
    assert {v["battery_capacity_kwh"] for v in data if v["model"] == "Tiago.ev"} == {19.2, 24}
    for v in data:
        assert v["source"]["url"].startswith("https://") and v["verified_on"] == "2026-10-07"
        assert "MIDC Part 1 + Part 2" in v["range_standard"]
        assert v["charging_curve"] is None and v["max_ac_charge_kw"] is None
    assert {v["max_dc_charge_kw"] for v in data if v["manufacturer"] == "MG"} == {45, 60}
    assert resolve(custom())["certified_range_km"] is None
    with pytest.raises(ValueError):
        resolve(EVSelection(catalog_id="unverified-edition"))


@pytest.mark.parametrize(
    "changes",
    [
        {"battery_capacity_kwh": 0},
        {"battery_capacity_kwh": float("nan")},
        {"name": " "},
        {"connector_types": []},
        {"connector_types": ["invented"]},
        {"max_dc_charge_kw": -5},
    ],
)
def test_invalid_custom_inputs(changes):
    body = {"name": "Test", "battery_capacity_kwh": 50, "connector_types": ["CCS2"], **changes}
    with pytest.raises(ValidationError):
        CustomEV(**body)


def test_api_requires_vehicle_but_station_browsing_is_open(loaded):
    body = {"origin": {"station_id": "0"}, "destination": {"station_id": "1"}}
    assert loaded.post("/api/trip", json=body).status_code == 422
    assert loaded.post("/api/trip/explain", json=body).status_code == 422
    assert loaded.get("/api/dataset").status_code == 200
    assert len(loaded.get("/api/vehicles").json()["vehicles"]) == 14
    assert (
        loaded.post("/api/trip", json={**body, "ev_profile": {"catalog_id": "bad"}}).status_code
        == 422
    )
    assert (
        loaded.post(
            "/api/trip",
            json={
                **body,
                "ev_profile": {
                    "catalog_id": catalog()["vehicles"][0]["id"],
                    "custom": custom().custom.model_dump(),
                },
            },
        ).status_code
        == 422
    )


def test_variant_change_recalculates_and_server_rejects_capacity_override(loaded, monkeypatch):
    monkeypatch.setattr("backend.main.get_provider", lambda: RoadProvider(km=20))
    data = catalog()["vehicles"]
    bodies = [
        {
            "origin": {"station_id": "0"},
            "destination": {"station_id": "1"},
            "vehicle": {"capacity_kwh": 499},
            "ev_profile": {"catalog_id": data[i]["id"]},
        }
        for i in [0, 2]
    ]
    results = [loaded.post("/api/trip", json=b).json()["battery"] for b in bodies]
    assert [r["assumptions"]["capacity_kwh"] for r in results] == [19.2, 24]
    assert results[0]["final_soc_pct"] < results[1]["final_soc_pct"]
    assert results[0]["estimated_remaining_range_km"] == pytest.approx(84)
    assert results[1]["estimated_remaining_range_km"] == pytest.approx(105)
    bodies[0]["vehicle"]["consumption_kwh_100km"] = 20
    updated = loaded.post("/api/trip", json=bodies[0]).json()["battery"]
    assert updated["final_soc_pct"] < results[0]["final_soc_pct"]


@pytest.mark.parametrize(
    "connector,status",
    [
        ("CCS Combo 2", "compatible"),
        ("CCS2;Type 2", "compatible"),
        ("CHAdeMO", "incompatible"),
        (None, "unknown"),
        ("GB/T", "unknown"),
        ("CCS1;undefined", "unknown"),
    ],
)
def test_connector_status_is_conservative(connector, status):
    assert compatibility(resolve(custom()), {"connector_type": connector})["status"] == status


def test_partial_vehicle_coverage_is_unknown_not_guessed_incompatible():
    assert (
        compatibility(catalog()["vehicles"][0], {"connector_type": "Type2"})["status"] == "unknown"
    )


def test_session_uses_both_limits_with_average_assumption_and_known_tariff():
    v = Vehicle(capacity_kwh=50)
    station = {"connector_type": "CCS2", "charging_power_kw": 100, "tariff_inr_per_kwh": 20}
    s = charge_session(resolve(custom()), station, 20, 80, v)
    assert s["power_ceiling_kw"] == 60
    assert s["charge_time_min"] == pytest.approx(30 / 0.9 / (60 * 0.7) * 60)
    assert s["energy_cost_inr"] == pytest.approx(30 / 0.9 * 20)
    station["charging_power_kw"] = 30
    assert charge_session(resolve(custom()), station, 20, 80, v)["power_ceiling_kw"] == 30
    station["tariff_inr_per_kwh"] = 0
    assert charge_session(resolve(custom()), station, 20, 80, v)["energy_cost_inr"] == 0
    assert "No documented taper" in s["charging_basis"]


@pytest.mark.parametrize(
    "station,profile",
    [
        ({"connector_type": "CCS2"}, custom()),
        ({"charging_power_kw": 100}, custom()),
        ({"connector_type": "CCS2", "charging_power_kw": 100}, custom(dc=None)),
        ({"connector_type": "CHAdeMO", "charging_power_kw": 100}, custom()),
    ],
)
def test_missing_specification_never_invents_time_or_tariff(station, profile):
    s = charge_session(resolve(profile), station, 20, 80, Vehicle())
    assert s["charge_time_min"] is None and s["energy_cost_inr"] is None


def test_documented_taper_band_model_and_uncovered_window():
    # Test-only model, not a claimed manufacturer curve.
    p = resolve(custom())
    p["charging_curve"] = {
        "source": "Test fixture only",
        "bands": [
            {"from_soc": 20, "to_soc": 60, "power_kw": 50},
            {"from_soc": 60, "to_soc": 80, "power_kw": 25},
        ],
    }
    station = {"connector_type": "CCS2", "charging_power_kw": 40}
    s = charge_session(p, station, 20, 80, Vehicle())
    assert s["charge_time_min"] == pytest.approx((20 / 40 + 10 / 25) / 0.9 * 60)
    assert charge_session(p, station, 20, 90, Vehicle())["charge_time_min"] is None


def test_unknown_charging_is_conditional_and_totals_stay_unknown():
    legs = [
        {
            "source": "0",
            "target": "1",
            "distance_km": 100,
            "can_charge": True,
            "charging_station": {},
        }
    ]
    b = engine.battery_simulation(legs, ["0", "1"], Vehicle(initial_soc=20), resolve(custom()))
    assert b["feasible"] and b["stops"] == 1 and b["conditional_charging"]
    assert b["charging_time_min"] is None and b["energy_cost_inr"] is None


def test_strict_connectors_exclude_unknown_stops_on_road_and_geographic_routes(records):
    graph = engine.build_graph(records[:3], GraphSettings())
    req = TripRequest(
        origin={"station_id": "0"},
        destination={"station_id": "2"},
        ev_profile={**custom(10).model_dump(), "allow_unknown_connectors": False},
        vehicle={"capacity_kwh": 10, "initial_soc": 50, "consumption_kwh_100km": 20},
    )
    road = road_trip(graph, req, RoadProvider(km=30))
    assert road["stations"] == [] and not road["battery"]["feasible"]
    geographic = engine.route(graph, req)
    assert not geographic["battery"]["feasible"]
    for node in graph.nodes.values():
        node["connector_type"] = "CHAdeMO"
    assert not road_trip(graph, req, RoadProvider(km=30))["battery"]["feasible"]


def test_tariffs_normalize_without_invented_values():
    data = [
        {
            "station_id": str(i),
            "station_name": "Test",
            "latitude": 28,
            "longitude": 77,
            "tariff_inr_per_kwh": rate,
        }
        for i, rate in enumerate([0, 25, -1, "nan", None])
    ]
    result = normalize(json.dumps(data).encode(), "test.json")
    assert [s["tariff_inr_per_kwh"] for s in result["stations"]] == [0, 25, None, None, None]


def test_gemini_unknown_time_is_preserved_without_location(monkeypatch):
    from backend import gemini

    monkeypatch.setenv("GEMINI_API_KEY", "test-only")
    seen = {}

    class Response:
        status_code = 200

        def json(self):
            return {"candidates": [{"content": {"parts": [{"text": "Test explanation"}]}}]}

    def capture(url, **kwargs):
        seen.update(kwargs["json"])
        return Response()

    monkeypatch.setattr("backend.gemini.httpx.post", capture)
    gemini.explain(
        {
            "found": True,
            "distance_km": 100,
            "estimated_travel_time_min": 90,
            "origin": {"label": "PRIVATE"},
            "battery": {
                "feasible": True,
                "reason": None,
                "final_soc_pct": 40,
                "stops": 1,
                "charging_time_min": None,
                "conditional_charging": True,
            },
        }
    )
    prompt = seen["contents"][0]["parts"][0]["text"]
    assert '"modeled_charging_minutes": null' in prompt and '"conditional_charging": true' in prompt
    assert "PRIVATE" not in prompt


def test_ambiguous_connector_output_rating_and_nacs_mode_remain_unknown():
    p = resolve(custom(connectors=["CCS2", "Type2", "NACS"]))
    for connector in ["CCS2;Type2", "NACS"]:
        assert (
            charge_session(
                p, {"connector_type": connector, "charging_power_kw": 100}, 20, 80, Vehicle()
            )["charge_time_min"]
            is None
        )


def test_peak_power_cannot_be_assumed_sustained():
    with pytest.raises(ValidationError):
        Vehicle(average_charge_fraction=1)
