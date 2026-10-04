"""Cartographic plausibility guard for the requested region; never repairs source GPS."""

import json
import math
from functools import lru_cache
from pathlib import Path

# The same local Natural Earth geometry used by the map. This is not an official border.
GEOMETRY = Path(__file__).resolve().parents[1] / "frontend/public/regions.geojson"
BORDER_TOLERANCE_KM = 5


def in_ring(lon, lat, ring):
    inside = False
    for (x1, y1), (x2, y2) in zip(ring, ring[1:] + ring[:1]):
        if (y1 > lat) != (y2 > lat) and lon < (x2 - x1) * (lat - y1) / (y2 - y1) + x1:
            inside = not inside
    return inside


@lru_cache(maxsize=1)
def polygons():
    result = []
    for feature in json.loads(GEOMETRY.read_text())["features"]:
        geometry = feature["geometry"]
        for polygon in (
            [geometry["coordinates"]] if geometry["type"] == "Polygon" else geometry["coordinates"]
        ):
            xs, ys = zip(*polygon[0])
            result.append((polygon, (min(xs), min(ys), max(xs), max(ys))))
    return result


@lru_cache(maxsize=8192)
def in_requested_region(latitude, longitude):
    lon_scale = 111.32 * math.cos(math.radians(latitude))
    for polygon, (west, south, east, north) in polygons():
        if not (
            west - BORDER_TOLERANCE_KM / lon_scale
            <= longitude
            <= east + BORDER_TOLERANCE_KM / lon_scale
            and south - BORDER_TOLERANCE_KM / 111.32
            <= latitude
            <= north + BORDER_TOLERANCE_KM / 111.32
        ):
            continue
        if in_ring(longitude, latitude, polygon[0]) and not any(
            in_ring(longitude, latitude, hole) for hole in polygon[1:]
        ):
            return True
        # A small disclosed tolerance avoids rejecting near-border points solely
        # because this generalized cartographic asset is not an official boundary.
        for ring in polygon:
            for (x1, y1), (x2, y2) in zip(ring, ring[1:] + ring[:1]):
                ax, ay = (x1 - longitude) * lon_scale, (y1 - latitude) * 111.32
                bx, by = (x2 - longitude) * lon_scale, (y2 - latitude) * 111.32
                dx, dy = bx - ax, by - ay
                t = max(0, min(1, -(ax * dx + ay * dy) / (dx * dx + dy * dy))) if dx or dy else 0
                if math.hypot(ax + t * dx, ay + t * dy) <= BORDER_TOLERANCE_KM:
                    return True
    return False
