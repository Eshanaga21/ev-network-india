"""Actual external geocoding/routing; credentials stay on the backend."""

import copy
import math
import os
import time
from functools import lru_cache
from pathlib import Path
from typing import Protocol

import httpx
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parents[1] / ".env", override=False)
HEADERS = {"User-Agent": "EVNetworkIndia/1.0 (local academic application)"}


class RoutingProvider(Protocol):
    def route(self, coordinates: list[tuple[float, float]]) -> dict: ...


@lru_cache(maxsize=128)
def road_response(base_url, coordinates, time_bucket):
    points = ";".join(f"{lon},{lat}" for lat, lon in coordinates)
    response = httpx.get(
        f"{base_url}/route/v1/driving/{points}",
        params={"overview": "full", "geometries": "geojson", "steps": "false"},
        headers=HEADERS,
        timeout=15,
    )
    response.raise_for_status()
    data = response.json()
    if data.get("code") != "Ok" or not data.get("routes"):
        raise ValueError("Road provider returned no route.")
    result = data["routes"][0]
    if (
        not isinstance(result.get("distance"), (int, float))
        or not math.isfinite(result["distance"])
        or result["distance"] < 0
    ):
        raise ValueError("Road provider returned an invalid distance.")
    if (
        not isinstance(result.get("duration"), (int, float))
        or not math.isfinite(result["duration"])
        or result["duration"] < 0
    ):
        raise ValueError("Road provider returned an invalid duration.")
    geometry = result.get("geometry", {})
    points = geometry.get("coordinates", [])
    if (
        geometry.get("type") != "LineString"
        or len(points) < 2
        or any(
            len(p) < 2
            or not all(isinstance(v, (int, float)) and math.isfinite(v) for v in p[:2])
            or not (-180 <= p[0] <= 180 and -90 <= p[1] <= 90)
            for p in points
        )
    ):
        raise ValueError("Road provider returned invalid geometry.")
    return {
        "provider": "OSRM",
        "distance_km": result["distance"] / 1000,
        "duration_min": result["duration"] / 60,
        "geometry": geometry,
        "legs": result.get("legs", []),
        "attribution": "OSRM · OpenStreetMap contributors (ODbL)",
        "label": "Provider-calculated road route; no live traffic or verified charger availability.",
    }


class OSRMProvider:
    def __init__(self, base_url):
        self.base_url = base_url.rstrip("/")

    def route(self, coordinates):
        return copy.deepcopy(
            road_response(self.base_url, tuple(coordinates), int(time.time() / 600))
        )


@lru_cache(maxsize=128)
def place_response(base_url, query, time_bucket):
    response = httpx.get(
        f"{base_url}/api/",
        params={"q": query, "limit": 5, "bbox": "68,6,98,38", "lang": "en"},
        headers=HEADERS,
        timeout=12,
    )
    response.raise_for_status()
    places = []
    for feature in response.json().get("features", []):
        geometry, props = feature.get("geometry", {}), feature.get("properties", {})
        coordinates = geometry.get("coordinates", [])
        if geometry.get("type") != "Point" or len(coordinates) < 2:
            continue
        lon, lat = coordinates[:2]
        if not all(isinstance(v, (int, float)) and math.isfinite(v) for v in (lat, lon)) or not (
            6 <= lat <= 38 and 68 <= lon <= 98
        ):
            continue
        if props.get("countrycode") and props["countrycode"].upper() != "IN":
            continue
        parts = [props.get(k) for k in ("name", "housenumber", "street", "city", "state")]
        label = ", ".join(dict.fromkeys(str(p) for p in parts if p))
        if not label:
            continue
        places.append(
            {
                "label": label,
                "latitude": lat,
                "longitude": lon,
                "provider": "Photon / OpenStreetMap",
                "osm_id": props.get("osm_id"),
            }
        )
    return {
        "places": places,
        "provider": "Photon / OpenStreetMap",
        "attribution": "OpenStreetMap contributors (ODbL)",
        "label": "Geocoded places, not charging station records.",
    }


class PhotonProvider:
    def __init__(self, base_url):
        self.base_url = base_url.rstrip("/")

    def search(self, query):
        return copy.deepcopy(place_response(self.base_url, query, int(time.time() / 600)))


def get_provider():
    url = os.getenv("EV_OSRM_URL", "https://router.project-osrm.org")
    return OSRMProvider(url) if url else None


def get_geocoder():
    url = os.getenv("EV_GEOCODER_URL", "https://photon.komoot.io")
    return PhotonProvider(url) if url else None
