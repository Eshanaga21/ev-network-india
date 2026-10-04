"""Exact graph calculations over imported observations; explicit modeled edges."""

import math
from time import perf_counter

import networkx as nx
import numpy as np
from sklearn.cluster import DBSCAN

from backend.models import GraphSettings

EARTH_KM = 6371.0088


def haversine(a, b):
    lat1, lon1, lat2, lon2 = map(math.radians, [a[0], a[1], b[0], b[1]])
    h = (
        math.sin((lat2 - lat1) / 2) ** 2
        + math.cos(lat1) * math.cos(lat2) * math.sin((lon2 - lon1) / 2) ** 2
    )
    return 2 * EARTH_KM * math.asin(math.sqrt(min(1, max(0, h))))


def distances(stations):
    coords = np.radians([[s["latitude"], s["longitude"]] for s in stations])
    if not len(coords):
        return np.empty((0, 0))
    lat, lon = coords[:, 0], coords[:, 1]
    h = (
        np.sin((lat[:, None] - lat) / 2) ** 2
        + np.cos(lat[:, None]) * np.cos(lat) * np.sin((lon[:, None] - lon) / 2) ** 2
    )
    return 2 * EARTH_KM * np.arcsin(np.sqrt(np.clip(h, 0, 1)))


def build_graph(stations, settings: GraphSettings):
    graph = nx.Graph()
    for s in stations:
        graph.add_node(s["station_id"], **s)
    matrix = distances(stations)
    for i, station in enumerate(stations):
        if settings.method == "radius":
            neighbors = [
                j for j in range(i + 1, len(stations)) if matrix[i, j] <= settings.radius_km
            ]
        else:
            # Stable distance, then source ID; union of directed nearest-neighbor selections.
            neighbors = sorted(
                (j for j in range(len(stations)) if j != i),
                key=lambda j: (matrix[i, j], stations[j]["station_id"]),
            )[: settings.k]
        for j in neighbors:
            distance = float(matrix[i, j])
            graph.add_edge(
                station["station_id"],
                stations[j]["station_id"],
                distance_km=distance,
                estimated_travel_time_min=distance / settings.speed_kmh * 60,
                route_cost=distance,
            )
    return graph


def summary(graph, include_average=False):
    components = sorted(nx.connected_components(graph), key=lambda c: (-len(c), sorted(c)))
    n = len(graph)
    result = {
        "nodes": n,
        "edges": graph.number_of_edges(),
        "components": len(components),
        "density": nx.density(graph),
        "isolated": len(list(nx.isolates(graph))),
        "largest_component_size": len(components[0]) if components else 0,
        "bridges": [list(edge) for edge in nx.bridges(graph)],
        "articulation_points": sorted(nx.articulation_points(graph)),
    }
    if include_average:
        total, pairs = 0.0, 0
        for component in components:
            subgraph = graph.subgraph(component)
            for a, lengths in nx.all_pairs_dijkstra_path_length(subgraph, weight="distance_km"):
                for b, distance in lengths.items():
                    if a < b:
                        total += distance
                        pairs += 1
        result["average_within_component_path_km"] = total / pairs if pairs else None
        result["reachable_pairs"] = pairs
    return result


def analyze(graph):
    stats = summary(graph)
    components = sorted(nx.connected_components(graph), key=lambda c: (-len(c), sorted(c)))
    component_ids = {node: i + 1 for i, nodes in enumerate(components) for node in nodes}
    # Co-located source records retain zero edge distances. Positive epsilon used only
    # for weighted centralities (NetworkX requires strictly positive betweenness weights).
    metric_graph = graph.copy()
    for _, _, data in metric_graph.edges(data=True):
        data["centrality_distance"] = max(data["distance_km"], 1e-9)
        data["strength"] = 1 / (1 + data["distance_km"])
    degree = nx.degree_centrality(graph)
    between = nx.betweenness_centrality(metric_graph, weight="centrality_distance")
    close = nx.closeness_centrality(metric_graph, distance="centrality_distance")
    page = nx.pagerank(metric_graph, weight="strength") if graph else {}
    stations = [graph.nodes[node] for node in graph]
    matrix = distances(stations)
    if len(matrix):
        np.fill_diagonal(matrix, np.inf)
    metrics = []
    for i, station in enumerate(stations):
        node = station["station_id"]
        nearest = float(matrix[i].min()) if len(stations) > 1 else None
        metrics.append(
            {
                **station,
                "degree": graph.degree(node),
                "weighted_degree_km": graph.degree(node, weight="distance_km"),
                "degree_centrality": degree[node],
                "betweenness_centrality": between[node],
                "closeness_centrality": close[node],
                "pagerank": page[node],
                "component_id": component_ids[node],
                "component_size": len(components[component_ids[node] - 1]),
                "articulation": node in stats["articulation_points"],
                "nearest_station_km": nearest,
                "nearby_station_count": sum(
                    1 for j in range(len(stations)) if i != j and matrix[i, j] <= 25
                ),
            }
        )
    values = [m["nearest_station_km"] for m in metrics if m["nearest_station_km"] is not None]
    avg_nearest = sum(values) / len(values) if values else None
    # Fixed, disclosed 100-km proximity scale; density is raw undirected density.
    health = {
        "largest_component": stats["largest_component_size"] / len(graph) if graph else 0,
        "density": stats["density"],
        "nonisolated": 1 - stats["isolated"] / len(graph) if graph else 0,
        "resilience": 1
        - (
            len(stats["articulation_points"]) / max(1, len(graph))
            + len(stats["bridges"]) / max(1, graph.number_of_edges())
        )
        / 2,
        "proximity": max(0, 1 - avg_nearest / 100) if avg_nearest is not None else 0,
    }
    weights = {
        "largest_component": 40,
        "density": 10,
        "nonisolated": 20,
        "resilience": 20,
        "proximity": 10,
    }
    stats["health"] = {
        "score": round(sum(health[k] * weights[k] for k in weights), 2) if graph else None,
        "inputs": health,
        "weights": weights,
        "average_nearest_km": avg_nearest,
        "label": "Calculated network health score; not official",
    }
    return {
        "summary": stats,
        "stations": metrics,
        "edges": [
            {
                "source": a,
                "target": b,
                **data,
                "bridge": [a, b] in stats["bridges"] or [b, a] in stats["bridges"],
            }
            for a, b, data in graph.edges(data=True)
        ],
        "adjacency": {
            node: [
                {"station_id": other, **graph.edges[node, other]} for other in graph.neighbors(node)
            ]
            for node in graph
        },
    }


def snap(point, graph):
    if point.station_id:
        if point.station_id not in graph:
            raise ValueError("Selected station is not in the filtered graph.")
        s = graph.nodes[point.station_id]
        return {
            "entered": point.model_dump(),
            "latitude": s["latitude"],
            "longitude": s["longitude"],
            "station_id": point.station_id,
            "station_name": s["station_name"],
            "snapped_latitude": s["latitude"],
            "snapped_longitude": s["longitude"],
            "snap_distance_km": 0.0,
        }
    if not graph:
        raise ValueError("No stations match the current filters.")
    sid = min(
        graph,
        key=lambda n: (
            haversine(
                (point.latitude, point.longitude),
                (graph.nodes[n]["latitude"], graph.nodes[n]["longitude"]),
            ),
            n,
        ),
    )
    station = graph.nodes[sid]
    return {
        "entered": point.model_dump(),
        "latitude": point.latitude,
        "longitude": point.longitude,
        "station_id": sid,
        "station_name": station["station_name"],
        "snapped_latitude": station["latitude"],
        "snapped_longitude": station["longitude"],
        "snap_distance_km": haversine(
            (point.latitude, point.longitude), (station["latitude"], station["longitude"])
        ),
    }


def battery_simulation(legs, path, vehicle):
    energy = vehicle.capacity_kwh * vehicle.initial_soc / 100
    reserve = vehicle.capacity_kwh * vehicle.reserve_soc / 100
    target = vehicle.capacity_kwh * vehicle.target_soc / 100
    consumed, added, charge_minutes, stops = 0.0, 0.0, 0.0, 0
    timeline = [
        {
            "event": "start",
            "station_id": path[0],
            "soc_pct": vehicle.initial_soc,
            "energy_kwh": 0,
            "charge_time_min": 0,
        }
    ]
    reason = None
    if energy < reserve:
        reason = "Initial SOC is below the configured reserve."
    for leg in legs:
        if reason:
            break
        needed = leg["distance_km"] * vehicle.consumption_kwh_100km / 100
        if energy - needed < reserve - 1e-9:
            if not leg.get("can_charge", True):
                reason = "Not enough starting charge to reach the next station or destination while keeping reserve. No charging is assumed at an arbitrary start."
                break
            if stops >= vehicle.max_stops:
                reason = "Maximum modeled charging stops exceeded."
                break
            if target - needed < reserve - 1e-9:
                reason = "The next geographic gap exceeds range at target SOC and reserve."
                break
            if energy >= target:
                reason = "Current SOC already exceeds target; the next leg cannot retain reserve."
                break
            delta = target - energy
            minutes = delta / (vehicle.assumed_charge_power_kw * vehicle.charge_efficiency) * 60
            energy = target
            added += delta
            charge_minutes += minutes
            stops += 1
            timeline.append(
                {
                    "event": "modeled charge",
                    "station_id": leg["source"],
                    "soc_pct": energy / vehicle.capacity_kwh * 100,
                    "energy_kwh": delta,
                    "grid_energy_kwh": delta / vehicle.charge_efficiency,
                    "charge_time_min": minutes,
                }
            )
        energy -= needed
        consumed += needed
        timeline.append(
            {
                "event": "travel",
                "station_id": leg["target"],
                "distance_km": leg["distance_km"],
                "soc_pct": energy / vehicle.capacity_kwh * 100,
                "energy_kwh": needed,
                "charge_time_min": 0,
            }
        )
    return {
        "feasible": reason is None,
        "reason": reason,
        "energy_consumed_kwh": consumed,
        "required_route_energy_kwh": sum(leg["distance_km"] for leg in legs)
        * vehicle.consumption_kwh_100km
        / 100,
        "charging_energy_kwh": added,
        "grid_energy_kwh": added / vehicle.charge_efficiency,
        "charging_time_min": charge_minutes,
        "final_soc_pct": energy / vehicle.capacity_kwh * 100,
        "stops": stops,
        "timeline": timeline,
        "assumptions": vehicle.model_dump(),
        "label": "User-configured model estimate; assumes charging is possible at route stations using entered power. Availability, connectors, queues and charging curves are not verified. Entered-point connector legs are included where present.",
    }


def route(graph, request):
    origin, destination = snap(request.origin, graph), snap(request.destination, graph)
    a, b = origin["station_id"], destination["station_id"]
    start = perf_counter()
    try:
        if request.algorithm == "astar":
            path = nx.astar_path(
                graph,
                a,
                b,
                heuristic=lambda x, y: haversine(
                    (graph.nodes[x]["latitude"], graph.nodes[x]["longitude"]),
                    (graph.nodes[y]["latitude"], graph.nodes[y]["longitude"]),
                ),
                weight="distance_km",
            )
        else:
            path = nx.dijkstra_path(graph, a, b, weight="distance_km")
    except nx.NetworkXNoPath:
        return {
            "found": False,
            "origin": origin,
            "destination": destination,
            "runtime_ms": (perf_counter() - start) * 1000,
            "algorithm": request.algorithm,
            "reason": "No path in this geographic-proximity graph. Increase radius or change k-nearest-neighbor settings; this does not establish road reachability.",
        }
    runtime = (perf_counter() - start) * 1000
    legs = [{"source": x, "target": y, **graph.edges[x, y]} for x, y in zip(path, path[1:])]
    network_distance = sum(leg["distance_km"] for leg in legs)
    trip_path = list(path)
    if origin["snap_distance_km"] > 1e-9:
        legs.insert(
            0,
            {
                "source": "entered:origin",
                "target": a,
                "distance_km": origin["snap_distance_km"],
                "estimated_travel_time_min": origin["snap_distance_km"]
                / request.graph.speed_kmh
                * 60,
                "can_charge": False,
                "kind": "geographic start connector",
            },
        )
        trip_path.insert(0, "entered:origin")
    if destination["snap_distance_km"] > 1e-9:
        legs.append(
            {
                "source": b,
                "target": "entered:destination",
                "distance_km": destination["snap_distance_km"],
                "estimated_travel_time_min": destination["snap_distance_km"]
                / request.graph.speed_kmh
                * 60,
                "can_charge": True,
                "kind": "geographic destination connector",
            }
        )
        trip_path.append("entered:destination")
    bridges = {frozenset(edge) for edge in nx.bridges(graph)}
    arts = set(nx.articulation_points(graph))
    bridge_legs = [leg for leg in legs if frozenset([leg["source"], leg["target"]]) in bridges]
    gaps = [leg["distance_km"] for leg in legs]
    return {
        "found": True,
        "origin": origin,
        "destination": destination,
        "algorithm": request.algorithm,
        "runtime_ms": runtime,
        "path": path,
        "stations": [graph.nodes[n] for n in path],
        "legs": legs,
        "distance_km": sum(gaps),
        "network_distance_km": network_distance,
        "estimated_travel_time_min": sum(leg["estimated_travel_time_min"] for leg in legs),
        "risk": {
            "classification": "High"
            if bridge_legs
            else "Moderate"
            if arts.intersection(path) or max(gaps, default=0) > 50
            else "Low",
            "route_station_count": len(path),
            "largest_gap_km": max(gaps, default=0),
            "average_edge_km": sum(gaps) / len(gaps) if gaps else 0,
            "articulation_points": sorted(arts.intersection(path)),
            "bridge_edges": [[leg["source"], leg["target"]] for leg in bridge_legs],
            "alternate_local_path_available": not bridge_legs if legs else None,
            "component_size": len(nx.node_connected_component(graph, a)),
            "formula": "High: at least one bridge edge; Moderate: articulation on path or geographic leg >50km; otherwise Low. Topological heuristic, not driving safety.",
        },
        "battery": battery_simulation(legs, trip_path, request.vehicle),
        "label": "Calculated geographic-proximity route; travel time is a user-configured speed estimate. Entered-point connector legs are included in route and battery totals; these are geographic estimates, not roads.",
    }


def resilience(graph, station_id, reference_id=None):
    if station_id not in graph:
        raise ValueError("Select a station in the filtered graph.")
    if reference_id == station_id or (reference_id and reference_id not in graph):
        raise ValueError("Reference must be a surviving station in the current graph.")
    before = summary(graph, include_average=True)
    simulated = graph.copy()
    simulated.remove_node(station_id)
    reference_id = reference_id or next(
        (n for n in sorted(nx.node_connected_component(graph, station_id)) if n != station_id),
        next(iter(simulated), None),
    )
    reachable_before = (
        set(nx.node_connected_component(graph, reference_id)) - {station_id}
        if reference_id
        else set()
    )
    reachable_after = (
        set(nx.node_connected_component(simulated, reference_id)) if reference_id else set()
    )
    after = summary(simulated, include_average=True)
    return {
        "station_id": station_id,
        "station_name": graph.nodes[station_id]["station_name"],
        "reference_id": reference_id,
        "before": {**before, "reachable_stations": len(reachable_before)},
        "after": {**after, "reachable_stations": len(reachable_after)},
        "disconnected_stations": sorted(reachable_before - reachable_after),
        "removed_was_articulation": station_id in before["articulation_points"],
        "removed_incident_bridges": [edge for edge in before["bridges"] if station_id in edge],
        "label": "Modeled station outage; source dataset and active graph are unchanged. Reachability compares surviving stations from the disclosed reference.",
    }


def accessibility(graph, request, metadata):
    if not graph:
        return {
            "ranking": [],
            "weights": request.weights,
            "label": "No stations match the filters.",
        }
    for field in ["availability", "ports", "power"]:
        key = {"ports": "num_chargers", "power": "charging_power_kw"}.get(field, field)
        available = (
            metadata.get("availability_index", False)
            if field == "availability"
            else metadata["capabilities"].get(key, False)
        )
        if request.weights.get(field, 0) and not available:
            raise ValueError(f"{field}: Not provided in usable form by current source.")
    stations = [graph.nodes[n] for n in graph]
    matrix = distances(stations)
    np.fill_diagonal(matrix, np.inf)
    nearest = [float(row.min()) if len(stations) > 1 else None for row in matrix]
    nearby = [int((row <= request.radius_km).sum()) for row in matrix]
    degree = [graph.degree(s["station_id"]) for s in stations]
    max_near, max_count = max(nearby, default=1) or 1, max(degree, default=1) or 1
    finite = [x for x in nearest if x is not None]
    max_distance = max(finite, default=1) or 1
    max_ports = max((s["num_chargers"] or 0 for s in stations), default=1) or 1
    max_power = max((s["charging_power_kw"] or 0 for s in stations), default=1) or 1
    ranking = []
    for i, s in enumerate(stations):
        availability_value = str(s["availability"]).lower()
        inputs = {
            "distance": 1 - nearest[i] / max_distance if nearest[i] is not None else None,
            "density": nearby[i] / max_near,
            "connectivity": degree[i] / max_count,
            "availability": 1
            if availability_value in {"1", "1.0", "available", "true"}
            else 0
            if availability_value in {"0", "0.0", "unavailable", "false"}
            else None,
            "ports": s["num_chargers"] / max_ports if s["num_chargers"] is not None else None,
            "power": s["charging_power_kw"] / max_power
            if s["charging_power_kw"] is not None
            else None,
        }
        coverage = sum(w for k, w in request.weights.items() if inputs[k] is not None)
        score = (
            100
            * sum(w * inputs[k] for k, w in request.weights.items() if inputs[k] is not None)
            / coverage
            if coverage
            else None
        )
        label = (
            "Insufficient data"
            if score is None
            else "Excellent"
            if score >= 80
            else "Good"
            if score >= 60
            else "Moderate"
            if score >= 40
            else "Poor"
            if score >= 20
            else "Very Poor"
        )
        ranking.append(
            {
                **s,
                "score": round(score, 2) if score is not None else None,
                "classification": label,
                "inputs": inputs,
                "weight_coverage_pct": coverage,
                "nearest_station_km": nearest[i],
                "nearby_station_count": nearby[i],
                "degree": degree[i],
            }
        )
    ranking.sort(key=lambda s: (-(s["score"] if s["score"] is not None else -1), s["station_id"]))
    return {
        "ranking": ranking,
        "weights": request.weights,
        "radius_km": request.radius_km,
        "formula": "100 × Σ(wᵢ × normalized inputᵢ) / Σ(available wᵢ). Distance=1−d/max(d); count, degree, ports, power=value/max(value); availability=0/1. Nearest distance excludes the station itself. Row missingness renormalizes available weights, disclosed as weight coverage. Relative to filtered station records, not general population accessibility or an official government metric.",
    }


def midpoint(a, b):
    vectors = []
    for s in (a, b):
        lat, lon = math.radians(s["latitude"]), math.radians(s["longitude"])
        vectors.append(
            np.array([math.cos(lat) * math.cos(lon), math.cos(lat) * math.sin(lon), math.sin(lat)])
        )
    vector = vectors[0] + vectors[1]
    vector /= np.linalg.norm(vector)
    return math.degrees(math.asin(vector[2])), math.degrees(math.atan2(vector[1], vector[0]))


def expansion(graph, request):
    stations = [graph.nodes[n] for n in graph]
    if len(stations) < 2:
        return {
            "candidates": [],
            "reason": "At least two imported stations are needed to derive geographic gaps.",
        }
    matrix = distances(stations)
    # Deterministic geographic minimum spanning tree generates gap edges without
    # adding edges to the analyzed station graph.
    complete = nx.Graph()
    complete.add_nodes_from(range(len(stations)))
    complete.add_weighted_edges_from(
        (i, j, float(matrix[i, j]))
        for i in range(len(stations))
        for j in range(i + 1, len(stations))
    )
    tree = nx.minimum_spanning_tree(complete, algorithm="kruskal")
    candidates, seen = [], set()
    before = summary(graph)
    for i, j, edge in sorted(tree.edges(data=True), key=lambda e: (-e[2]["weight"], e[0], e[1])):
        if edge["weight"] < 0.001:
            continue
        lat, lon = midpoint(stations[i], stations[j])
        if not (6 <= lat <= 38 and 68 <= lon <= 98):
            continue
        key = (round(lat, 6), round(lon, 6))
        if key in seen:
            continue
        seen.add(key)
        site_distances = [haversine((lat, lon), (s["latitude"], s["longitude"])) for s in stations]
        if min(site_distances) < 0.001:
            continue
        nearby = sum(d <= request.coverage_radius_km for d in site_distances)
        candidate = {
            "station_id": f"candidate-{i}-{j}",
            "station_name": "Modeled expansion candidate",
            "latitude": lat,
            "longitude": lon,
        }
        simulated = build_graph([*stations, candidate], request.graph)
        after = summary(simulated)
        merged = max(0, before["components"] + 1 - after["components"])
        gap = edge["weight"]
        improvement = gap / 2
        score_inputs = {
            "gap": min(site_distances) / max(1, float(matrix.max())),
            "scarcity": 1 / (1 + nearby),
            "connectivity": min(1, merged / max(1, before["components"])),
            "gap_improvement": improvement / max(1, float(matrix.max())),
        }
        score = 100 * (
            0.35 * score_inputs["gap"]
            + 0.25 * score_inputs["scarcity"]
            + 0.25 * score_inputs["connectivity"]
            + 0.15 * score_inputs["gap_improvement"]
        )
        candidates.append(
            {
                "candidate_id": candidate["station_id"],
                "latitude": lat,
                "longitude": lon,
                "score": round(score, 2),
                "nearest_station_km": min(site_distances),
                "nearby_station_count": nearby,
                "gap_edge_km": gap,
                "gap_improvement_km": improvement,
                "score_inputs": score_inputs,
                "endpoints": [stations[i]["station_id"], stations[j]["station_id"]],
                "reason": f"Spherical midpoint of a {gap:.1f} km geographic MST gap; {nearby} source stations within {request.coverage_radius_km:g} km; addition joins {merged} existing component(s).",
                "before": before,
                "after": after,
            }
        )
        # Bounded deterministic candidate pool, disclosed in API and UI.
        if len(candidates) >= 40:
            break
    candidates.sort(key=lambda s: (-s["score"], s["candidate_id"]))
    return {
        "candidates": candidates[:10],
        "pool_size": len(candidates),
        "method": "Top 40 longest positive geographic MST edges → spherical midpoints → score → top 10. Weights: gap 35%, scarcity 25%, component joining 25%, pair-gap halving 15%. Gap normalized by maximum station separation. Addition rebuilds the configured graph, including k-NN neighbor changes. Pair-gap halving is a geometric proxy, not measured area coverage. Sites may be on water or unsuitable land; no demand, road, population, grid, land or investment claims.",
    }


def clusters(graph, request):
    stations = [graph.nodes[n] for n in graph]
    if not stations:
        return {"stations": [], "clusters": [], "isolated": 0}
    coords = np.radians([[s["latitude"], s["longitude"]] for s in stations])
    labels = DBSCAN(
        eps=request.radius_km / EARTH_KM,
        min_samples=request.min_samples,
        metric="haversine",
        algorithm="ball_tree",
    ).fit_predict(coords)
    return {
        "stations": [{**s, "cluster_id": int(label)} for s, label in zip(stations, labels)],
        "clusters": [
            {"cluster_id": int(label), "size": int(sum(labels == label))}
            for label in sorted(set(labels))
            if label != -1
        ],
        "isolated": int(sum(labels == -1)),
        "radius_km": request.radius_km,
        "min_samples": request.min_samples,
        "label": "Calculated DBSCAN geographic concentration; not demand. Noise label −1 denotes stations outside qualifying clusters.",
    }
