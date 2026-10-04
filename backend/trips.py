"""Door-to-door road estimates using actual provider geometry and source stations."""

import math

from backend import engine

CORRIDOR_KM = 5


def corridor_stations(stations, road):
    coordinates = road["geometry"]["coordinates"]
    segments, cumulative = [], 0.0
    for a, b in zip(coordinates, coordinates[1:]):
        distance = engine.haversine((a[1], a[0]), (b[1], b[0]))
        segments.append((a, b, cumulative, distance))
        cumulative += distance
    if not cumulative:
        return []
    candidates = []
    for station in stations:
        lon, lat = station["longitude"], station["latitude"]
        scale = 111.32 * math.cos(math.radians(lat))
        closest, progress = float("inf"), 0.0
        for a, b, start, distance in segments:
            ax, ay = (a[0] - lon) * scale, (a[1] - lat) * 111.32
            dx, dy = (b[0] - a[0]) * scale, (b[1] - a[1]) * 111.32
            t = max(0, min(1, -(ax * dx + ay * dy) / (dx * dx + dy * dy))) if dx or dy else 0
            gap = math.hypot(ax + t * dx, ay + t * dy)
            if gap < closest:
                closest, progress = gap, (start + t * distance) / cumulative * road["distance_km"]
        if closest <= CORRIDOR_KM and 0.1 < progress < road["distance_km"] - 0.1:
            candidates.append(
                {"station": station, "progress_km": progress, "distance_to_route_km": closest}
            )
    return candidates


def selected_stops(stations, road, request):
    vehicle = request.vehicle
    per_km = vehicle.consumption_kwh_100km / 100
    initial_range = (
        vehicle.capacity_kwh * max(0, vehicle.initial_soc - vehicle.reserve_soc) / 100 / per_km
    )
    full_range = vehicle.capacity_kwh * (vehicle.target_soc - vehicle.reserve_soc) / 100 / per_km
    # If the start is an observed station, modeled charging there is permitted.
    reach = (
        full_range
        if request.origin.station_id and initial_range < road["distance_km"]
        else initial_range
    )
    if reach >= road["distance_km"]:
        return []
    candidates = corridor_stations(stations, road)
    stops, position = [], 0.0
    while position + reach < road["distance_km"] and len(stops) < vehicle.max_stops:
        # Leave room for the actual road detour, verified in a second provider route.
        available = [
            c for c in candidates if position + 0.1 < c["progress_km"] <= position + reach * 0.9
        ]
        if not available:
            break
        chosen = max(
            available,
            key=lambda c: (
                c["progress_km"],
                -c["distance_to_route_km"],
                c["station"]["station_id"],
            ),
        )
        stops.append(chosen)
        position, reach = chosen["progress_km"], full_range
    return stops


def road_trip(graph, request, provider):
    origin, destination = (
        engine.snap(request.origin, graph),
        engine.snap(request.destination, graph),
    )
    points = [
        (origin["latitude"], origin["longitude"]),
        (destination["latitude"], destination["longitude"]),
    ]
    road = provider.route(points)
    selected = selected_stops(list(graph.nodes.values()), road, request)
    if selected:
        road = provider.route(
            [
                points[0],
                *[(c["station"]["latitude"], c["station"]["longitude"]) for c in selected],
                points[-1],
            ]
        )
    stops = [c["station"] for c in selected]
    ids = [
        request.origin.station_id or "entered:origin",
        *[s["station_id"] for s in stops],
        request.destination.station_id or "entered:destination",
    ]
    raw_legs = road.get("legs", [])
    if len(raw_legs) != len(ids) - 1:
        raise ValueError("Road provider omitted waypoint leg distances.")
    legs = []
    for index, leg in enumerate(raw_legs):
        distance, duration = leg.get("distance"), leg.get("duration")
        if not all(
            isinstance(v, (int, float)) and math.isfinite(v) and v >= 0
            for v in (distance, duration)
        ):
            raise ValueError("Road provider returned invalid waypoint leg values.")
        legs.append(
            {
                "source": ids[index],
                "target": ids[index + 1],
                "distance_km": distance / 1000,
                "estimated_travel_time_min": duration / 60,
                "can_charge": bool(index > 0 or request.origin.station_id),
                "kind": "provider road leg",
            }
        )
    battery = engine.battery_simulation(legs, ids, request.vehicle)
    battery["label"] = (
        "Road leg distances with user-entered battery and charging assumptions. Charging at source stations is modeled; availability and compatibility are unverified. No charging assumed at arbitrary starting points."
    )
    for endpoint, point in ((origin, request.origin), (destination, request.destination)):
        endpoint["label"] = point.label or (
            endpoint["station_name"]
            if point.station_id
            else f"{point.latitude:.5f}, {point.longitude:.5f}"
        )
    return {
        "found": True,
        "route_mode": "road",
        "origin": origin,
        "destination": destination,
        "road_route": road,
        "distance_km": road["distance_km"],
        "estimated_travel_time_min": road["duration_min"],
        "stations": stops,
        "path": [s["station_id"] for s in stops],
        "legs": legs,
        "battery": battery,
        "charging_plan": {
            "method": "Deterministic forward-progress station selection within 5 km of the provider route, then re-route through actual station coordinates and validate battery against provider waypoint legs. This is a heuristic, not an optimal itinerary.",
            "corridor_km": CORRIDOR_KM,
            "selected_source_stations": len(stops),
        },
        "label": "Provider road route from entered start to entered destination. Charging is an explicit model estimate; not live traffic or verified charger availability.",
    }
