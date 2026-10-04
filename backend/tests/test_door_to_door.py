import httpx
import pytest

from backend import engine, gemini
from backend.models import GraphSettings, Point, RouteRequest
from backend.providers import PhotonProvider, place_response
from backend.trips import road_trip


class RoadProvider:
    def __init__(self, km=20):
        self.km = km
        self.calls = []

    def route(self, coordinates):
        self.calls.append(coordinates)
        return {
            "provider": "Test-only provider",
            "distance_km": self.km,
            "duration_min": 30,
            "geometry": {
                "type": "LineString",
                "coordinates": [[lon, lat] for lat, lon in coordinates],
            },
            "legs": [
                {
                    "distance": self.km * 1000 / (len(coordinates) - 1),
                    "duration": 1800 / (len(coordinates) - 1),
                }
                for _ in coordinates[1:]
            ],
        }


def test_home_to_destination_road_ignores_disconnected_station_graph(records):
    graph = engine.build_graph(records, GraphSettings(radius_km=1))
    provider = RoadProvider()
    result = road_trip(
        graph,
        RouteRequest(
            origin=Point(latitude=28.01, longitude=77, label="Entered public place"),
            destination=Point(latitude=28.21, longitude=77),
        ),
        provider,
    )
    assert provider.calls[0] == [(28.01, 77), (28.21, 77)]
    assert result["found"] and result["route_mode"] == "road"
    assert result["distance_km"] == 20
    assert result["battery"]["energy_consumed_kwh"] == pytest.approx(3.2)
    assert result["battery"]["final_soc_pct"] == pytest.approx(73.6)
    assert result["stations"] == []
    assert result["origin"]["label"] == "Entered public place"
    assert len(graph) == len(records)


def test_arbitrary_home_is_not_a_charging_station(records):
    graph = engine.build_graph(records, GraphSettings())
    result = road_trip(
        graph,
        RouteRequest(
            origin=Point(latitude=28.01, longitude=77),
            destination=Point(latitude=28.3, longitude=78),
            vehicle={"initial_soc": 10},
        ),
        RoadProvider(km=100),
    )
    assert not result["battery"]["feasible"]
    assert result["battery"]["stops"] == 0
    assert "arbitrary start" in result["battery"]["reason"]


def test_road_charging_waypoint_uses_actual_record_and_rechecks_legs(records):
    graph = engine.build_graph(records[:3], GraphSettings())
    result = road_trip(
        graph,
        RouteRequest(
            origin=Point(latitude=28.001, longitude=77),
            destination=Point(latitude=28.201, longitude=77),
            vehicle={"capacity_kwh": 10, "initial_soc": 50, "consumption_kwh_100km": 20},
        ),
        RoadProvider(km=30),
    )
    assert result["stations"]
    assert all(s["station_id"] in graph for s in result["stations"])
    assert result["battery"]["feasible"]
    assert result["battery"]["stops"] == 1
    assert result["battery"]["required_route_energy_kwh"] == pytest.approx(6)


def test_geographic_connectors_are_in_totals_and_no_charging_at_home(records):
    graph = engine.build_graph(records, GraphSettings(radius_km=12))
    result = engine.route(
        graph,
        RouteRequest(
            origin=Point(latitude=28.01, longitude=77),
            destination=Point(latitude=28.21, longitude=77),
        ),
    )
    assert result["distance_km"] > result["network_distance_km"]
    assert len(result["legs"]) == 4
    assert not result["legs"][0]["can_charge"]
    assert result["battery"]["required_route_energy_kwh"] == pytest.approx(
        result["distance_km"] * 0.16
    )


def test_trip_api_falls_back_honestly_on_road_failure(loaded, monkeypatch):
    class Broken:
        def route(self, coordinates):
            raise httpx.ConnectError("offline")

    monkeypatch.setattr("backend.main.get_provider", lambda: Broken())
    result = loaded.post(
        "/api/trip",
        json={"origin": {"latitude": 28.01, "longitude": 77}, "destination": {"station_id": "1"}},
    ).json()
    assert result["route_mode"] == "geographic"
    assert "Road service is unavailable" in result["road_error"]
    assert result["audit"]["route_mode"] == "geographic"
    assert result["distance_km"] > result["network_distance_km"]


def test_geocoding_filters_invalid_and_foreign_features(client, monkeypatch):
    class Response:
        def raise_for_status(self):
            pass

        def json(self):
            return {
                "features": [
                    {
                        "geometry": {"type": "Point", "coordinates": [77.2, 28.6]},
                        "properties": {
                            "name": "Public place",
                            "countrycode": "IN",
                            "city": "Delhi",
                        },
                    },
                    {
                        "geometry": {"type": "Point", "coordinates": [77, 91]},
                        "properties": {"name": "Bad"},
                    },
                    {
                        "geometry": {"type": "Point", "coordinates": [77, 28]},
                        "properties": {"name": "Foreign", "countrycode": "PK"},
                    },
                ]
            }

    place_response.cache_clear()
    monkeypatch.setattr("backend.providers.httpx.get", lambda *a, **k: Response())
    provider = PhotonProvider("https://test-only.invalid")
    monkeypatch.setattr("backend.main.get_geocoder", lambda: provider)
    result = client.post("/api/places/search", json={"query": "Public place"}).json()
    assert len(result["places"]) == 1
    assert result["places"][0]["latitude"] == 28.6
    assert not client.get("/api/dataset").json()["loaded"]
    assert client.post("/api/places/search", json={"query": "a"}).status_code == 422


def test_disabled_or_failed_geocoding_never_invents_locations(client, monkeypatch):
    assert client.post("/api/places/search", json={"query": "Delhi"}).status_code == 503

    class Broken:
        def search(self, query):
            raise httpx.ConnectError("offline")

    monkeypatch.setattr("backend.main.get_geocoder", lambda: Broken())
    result = client.post("/api/places/search", json={"query": "Delhi"})
    assert result.status_code == 502
    assert "latitude, longitude" in result.json()["detail"]


def test_gemini_prompt_contains_no_address_location_or_key(monkeypatch):
    monkeypatch.setenv("GEMINI_API_KEY", "test-only-credential")
    seen = {}

    class Response:
        status_code = 200

        def json(self):
            return {"candidates": [{"content": {"parts": [{"text": "Calculated explanation."}]}}]}

    def capture(url, **kwargs):
        seen.update(kwargs)
        return Response()

    monkeypatch.setattr("backend.gemini.httpx.post", capture)
    result = gemini.explain(
        {
            "found": True,
            "route_mode": "road",
            "origin": {"label": "PRIVATE ADDRESS", "latitude": 28.1234567},
            "distance_km": 12,
            "estimated_travel_time_min": 20,
            "battery": {
                "feasible": True,
                "reason": None,
                "final_soc_pct": 76,
                "stops": 0,
                "charging_time_min": 0,
            },
        }
    )
    prompt = str(seen["json"])
    assert "PRIVATE ADDRESS" not in prompt
    assert "28.1234567" not in prompt
    assert "test-only-credential" not in prompt
    assert result["text"] == "Calculated explanation."
    assert "test-only-credential" not in str(result)


def test_gemini_auth_error_is_safe_and_calculations_remain_available(loaded, monkeypatch):
    monkeypatch.setenv("GEMINI_API_KEY", "test-only-credential")

    class Response:
        status_code = 401

    monkeypatch.setattr("backend.gemini.httpx.post", lambda *a, **k: Response())
    body = {"origin": {"station_id": "0"}, "destination": {"station_id": "1"}}
    response = loaded.post("/api/trip/explain", json=body)
    assert response.status_code == 502
    assert "test-only-credential" not in response.text
    assert loaded.post("/api/trip", json=body).status_code == 200
