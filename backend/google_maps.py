"""Google Maps Platform adapters. Server keys and responses are never persisted."""

import math
import os
import re

import httpx


def map_config():
    browser_key = os.getenv("GOOGLE_MAPS_BROWSER_KEY", "").strip()
    return {
        "provider": "Google Maps" if browser_key else "MapLibre",
        "browser_key": browser_key or None,
        "map_id": os.getenv("GOOGLE_MAPS_MAP_ID", "DEMO_MAP_ID") or "DEMO_MAP_ID",
        "services_configured": bool(browser_key and os.getenv("GOOGLE_MAPS_API_KEY", "").strip()),
    }


def configured():
    return map_config()["services_configured"]


def number(value):
    return isinstance(value, (int, float)) and not isinstance(value, bool) and math.isfinite(value)


def duration(value):
    if not isinstance(value, str) or not re.fullmatch(r"\d+(?:\.\d+)?s", value):
        raise ValueError("Google Maps returned an invalid duration.")
    seconds = float(value[:-1])
    if not math.isfinite(seconds):
        raise ValueError("Google Maps returned an invalid duration.")
    return seconds


def decode_polyline(encoded):
    if not isinstance(encoded, str) or not encoded:
        raise ValueError("Google Maps omitted route geometry.")
    index, lat, lon, points = 0, 0, 0, []
    while index < len(encoded):
        deltas = []
        for _ in range(2):
            value, shift = 0, 0
            while True:
                if index >= len(encoded) or shift > 30:
                    raise ValueError("Google Maps returned invalid route geometry.")
                byte = ord(encoded[index]) - 63
                index += 1
                if not 0 <= byte <= 63:
                    raise ValueError("Google Maps returned invalid route geometry.")
                value |= (byte & 31) << shift
                shift += 5
                if byte < 32:
                    break
            deltas.append(~(value >> 1) if value & 1 else value >> 1)
        lat, lon = lat + deltas[0], lon + deltas[1]
        if not (-90 <= lat / 1e5 <= 90 and -180 <= lon / 1e5 <= 180):
            raise ValueError("Google Maps returned out-of-range geometry.")
        points.append([lon / 1e5, lat / 1e5])
    if len(points) < 2:
        raise ValueError("Google Maps returned incomplete geometry.")
    return {"type": "LineString", "coordinates": points}


def google_post(url, body, field_mask):
    response = httpx.post(
        url,
        headers={
            "X-Goog-Api-Key": os.environ["GOOGLE_MAPS_API_KEY"],
            "X-Goog-FieldMask": field_mask,
        },
        json=body,
        timeout=20,
    )
    # Never echo Google's error payload: only actionable, credential-free errors.
    if response.status_code != 200:
        raise ValueError(
            f"Google Maps request failed ({response.status_code}). Check API enablement, key restrictions, billing and quota."
        )
    return response.json()


class GoogleRoutesProvider:
    name = "Google Maps Routes"

    def route(self, coordinates):
        if not 2 <= len(coordinates) <= 27:
            raise ValueError("Google Routes supports at most 25 intermediate stops.")
        waypoints = [
            {"location": {"latLng": {"latitude": lat, "longitude": lon}}}
            for lat, lon in coordinates
        ]
        data = google_post(
            "https://routes.googleapis.com/directions/v2:computeRoutes",
            {
                "origin": waypoints[0],
                "destination": waypoints[-1],
                "intermediates": waypoints[1:-1],
                "travelMode": "DRIVE",
                "routingPreference": "TRAFFIC_UNAWARE",
                "polylineQuality": "HIGH_QUALITY",
                "languageCode": "en-IN",
                "units": "METRIC",
            },
            "routes.distanceMeters,routes.duration,routes.polyline.encodedPolyline,routes.legs.distanceMeters,routes.legs.duration",
        )
        if not data.get("routes"):
            raise ValueError("Google Maps returned no driving route.")
        route = data["routes"][0]
        distance = route.get("distanceMeters")
        if not number(distance) or distance < 0:
            raise ValueError("Google Maps returned an invalid road distance.")
        legs = []
        for leg in route.get("legs", []):
            meters = leg.get("distanceMeters")
            if not number(meters) or meters < 0:
                raise ValueError("Google Maps returned an invalid leg distance.")
            legs.append({"distance": meters, "duration": duration(leg.get("duration"))})
        if len(legs) != len(coordinates) - 1:
            raise ValueError("Google Maps omitted waypoint legs.")
        if abs(sum(leg["distance"] for leg in legs) - distance) > max(5, len(legs)):
            raise ValueError("Google Maps returned inconsistent route and leg distances.")
        return {
            "provider": self.name,
            "distance_km": distance / 1000,
            "duration_min": duration(route.get("duration")) / 60,
            "geometry": decode_polyline(route.get("polyline", {}).get("encodedPolyline")),
            "legs": legs,
            "attribution": "Google Maps",
            "label": "Google Maps driving estimate without live traffic; charger availability is unverified.",
        }


class GooglePlacesProvider:
    name = "Google Maps Places"

    def search(self, query):
        data = google_post(
            "https://places.googleapis.com/v1/places:searchText",
            {
                "textQuery": query,
                "pageSize": 5,
                "languageCode": "en",
                "regionCode": "IN",
                "locationBias": {
                    "rectangle": {
                        "low": {"latitude": 6, "longitude": 68},
                        "high": {"latitude": 38, "longitude": 98},
                    }
                },
            },
            "places.id,places.displayName,places.formattedAddress,places.location,places.attributions",
        )
        places = []
        for place in data.get("places", []):
            location = place.get("location", {})
            lat, lon = location.get("latitude"), location.get("longitude")
            if not number(lat) or not number(lon) or not (6 <= lat <= 38 and 68 <= lon <= 98):
                continue
            label = ", ".join(
                dict.fromkeys(
                    v
                    for v in (
                        place.get("displayName", {}).get("text"),
                        place.get("formattedAddress"),
                    )
                    if v
                )
            )
            if label:
                places.append(
                    {
                        "label": label[:300],
                        "latitude": lat,
                        "longitude": lon,
                        "place_id": place.get("id"),
                        "provider": self.name,
                        "attributions": place.get("attributions", []),
                    }
                )
        return {
            "places": places,
            "provider": self.name,
            "attribution": "Google Maps",
            "label": "Google place results; separate from imported charging records.",
        }
