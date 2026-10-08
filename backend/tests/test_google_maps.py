import httpx
import pytest

from backend import google_maps, providers


def enable(monkeypatch):
    monkeypatch.setenv("GOOGLE_MAPS_API_KEY", "server-test-key")
    monkeypatch.setenv("GOOGLE_MAPS_BROWSER_KEY", "browser-test-key")


def route_payload():
    return {
        "routes": [
            {
                "distanceMeters": 3000,
                "duration": "240.5s",
                "polyline": {"encodedPolyline": "_p~iF~ps|U_ulLnnqC_mqNvxq`@"},
                "legs": [
                    {"distanceMeters": 1000, "duration": "80s"},
                    {"distanceMeters": 2000, "duration": "160.5s"},
                ],
            }
        ]
    }


def test_polyline_decodes_negative_longitude_and_order():
    assert google_maps.decode_polyline("_p~iF~ps|U_ulLnnqC_mqNvxq`@") == {
        "type": "LineString",
        "coordinates": [[-120.2, 38.5], [-120.95, 40.7], [-126.453, 43.252]],
    }


@pytest.mark.parametrize("value", ["", "_", "??", "\n", "~~~~~~~~~~~~"])
def test_invalid_geometry_is_rejected(value):
    with pytest.raises(ValueError):
        google_maps.decode_polyline(value)


@pytest.mark.parametrize("value", [None, -1, "-5s", "nan", "Infinitys", "9" * 400 + "s"])
def test_invalid_duration_is_rejected(value):
    with pytest.raises(ValueError):
        google_maps.duration(value)


def test_routes_preserve_waypoints_units_and_do_not_cache(monkeypatch):
    enable(monkeypatch)
    calls = []

    def post(url, **kwargs):
        calls.append((url, kwargs))
        return httpx.Response(200, json=route_payload())

    monkeypatch.setattr(google_maps.httpx, "post", post)
    provider = providers.get_provider()
    coords = [(28.61, 77.23), (28.6, 77.2), (28.47, 77.08)]
    result = provider.route(coords)
    provider.route(coords)
    assert len(calls) == 2
    assert result["distance_km"] == 3
    assert result["duration_min"] == pytest.approx(240.5 / 60)
    assert [leg["distance"] for leg in result["legs"]] == [1000, 2000]
    body = calls[0][1]["json"]
    assert body["origin"]["location"]["latLng"] == {"latitude": 28.61, "longitude": 77.23}
    assert body["intermediates"][0]["location"]["latLng"] == {"latitude": 28.6, "longitude": 77.2}
    assert body["destination"]["location"]["latLng"] == {"latitude": 28.47, "longitude": 77.08}
    assert body["routingPreference"] == "TRAFFIC_UNAWARE"
    assert calls[0][1]["headers"]["X-Goog-Api-Key"] == "server-test-key"
    assert "*" not in calls[0][1]["headers"]["X-Goog-FieldMask"]
    assert "key" not in calls[0][0].lower()


@pytest.mark.parametrize("change", ["missing-leg", "inconsistent-distance", "invalid-duration"])
def test_incomplete_route_metrics_never_become_battery_estimates(monkeypatch, change):
    data = route_payload()
    route = data["routes"][0]
    if change == "missing-leg":
        route["legs"].pop()
    elif change == "inconsistent-distance":
        route["distanceMeters"] = 4000
    else:
        route["legs"][0]["duration"] = "bad"
    monkeypatch.setattr(google_maps, "google_post", lambda *args: data)
    with pytest.raises(ValueError):
        google_maps.GoogleRoutesProvider().route([(28, 77), (29, 77), (30, 77)])


def test_places_preserve_attribution_and_reject_invalid_coordinates(monkeypatch):
    good = {
        "id": "place-test-id",
        "displayName": {"text": "India Gate"},
        "formattedAddress": "New Delhi, India",
        "location": {"latitude": 28.6129, "longitude": 77.2295},
        "attributions": [{"provider": "Test contributor", "providerUri": "https://example.org"}],
    }
    monkeypatch.setattr(
        google_maps,
        "google_post",
        lambda *args: {
            "places": [
                good,
                {**good, "location": {"latitude": 0, "longitude": 0}},
                {**good, "location": {"latitude": True, "longitude": 77}},
                {**good, "location": {}},
            ]
        },
    )
    result = google_maps.GooglePlacesProvider().search("India Gate")
    assert len(result["places"]) == 1
    place = result["places"][0]
    assert place["label"] == "India Gate, New Delhi, India"
    assert place["attributions"] == good["attributions"]
    assert "station_id" not in place


def test_public_config_contains_browser_key_only_and_academic_provider_stays_osrm(
    client, monkeypatch
):
    enable(monkeypatch)
    monkeypatch.setenv("EV_OSRM_URL", "https://example.org")
    response = client.get("/api/maps/config")
    assert response.status_code == 200
    assert response.headers["Cache-Control"] == "no-store"
    assert response.json()["browser_key"] == "browser-test-key"
    assert "server-test-key" not in response.text
    assert isinstance(providers.get_geocoder(), google_maps.GooglePlacesProvider)
    assert isinstance(providers.get_academic_provider(), providers.OSRMProvider)
    assert client.get("/api/health").json()["road_provider"] == "Google Maps Routes"
    monkeypatch.setenv("GOOGLE_MAPS_BROWSER_KEY", "")
    assert isinstance(providers.get_provider(), providers.OSRMProvider)
    assert not google_maps.configured()


def test_authentication_error_does_not_echo_payload_or_credentials(monkeypatch):
    enable(monkeypatch)
    monkeypatch.setattr(
        google_maps.httpx,
        "post",
        lambda *args, **kwargs: httpx.Response(
            403, json={"error": "server-test-key private payload"}
        ),
    )
    with pytest.raises(ValueError) as error:
        google_maps.GooglePlacesProvider().search("India Gate")
    assert "403" in str(error.value)
    assert "server-test-key" not in str(error.value)
    assert "private payload" not in str(error.value)
