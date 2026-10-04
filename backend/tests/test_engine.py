import networkx as nx
import pytest
from pydantic import ValidationError

from backend.engine import (
    accessibility,
    analyze,
    battery_simulation,
    build_graph,
    clusters,
    expansion,
    haversine,
    resilience,
    route,
)
from backend.models import (
    AccessibilityRequest,
    ClusterRequest,
    ExpansionRequest,
    GraphSettings,
    Point,
    RouteRequest,
    Vehicle,
)


def test_haversine():
    assert haversine((28, 77), (28, 77)) == 0
    assert haversine((0, 0), (0, 1)) == pytest.approx(111.195, rel=1e-4)


def test_radius_and_disconnected(records):
    graph = build_graph(records, GraphSettings(radius_km=12))
    assert graph.number_of_edges() == 2
    assert nx.number_connected_components(graph) == 2
    assert set(nx.articulation_points(graph)) == {"1"}
    assert graph.edges["0", "1"]["route_cost"] == graph.edges["0", "1"]["distance_km"]
    assert graph.edges["0", "1"]["estimated_travel_time_min"] == pytest.approx(
        11.1195 / 45 * 60, rel=1e-4
    )
    metrics = analyze(graph)
    assert metrics["summary"]["isolated"] == 1
    assert 0 <= metrics["summary"]["health"]["score"] <= 100
    assert metrics["adjacency"]["3"] == []


def test_knn_does_not_force_connected(records):
    # Two separated pairs, each pair chooses only its local neighbor.
    records[3].update(latitude=12.1, longitude=80)
    records[2].update(latitude=12, longitude=80)
    graph = build_graph(records, GraphSettings(method="knn", k=1))
    assert nx.number_connected_components(graph) == 2


@pytest.mark.parametrize("algorithm", ["dijkstra", "astar"])
def test_shortest_path(records, algorithm):
    graph = build_graph(records, GraphSettings(radius_km=12))
    result = route(
        graph,
        RouteRequest(
            origin=Point(station_id="0"), destination=Point(station_id="2"), algorithm=algorithm
        ),
    )
    assert result["path"] == ["0", "1", "2"]
    assert result["distance_km"] == pytest.approx(22.239, rel=1e-4)
    assert result["runtime_ms"] >= 0
    assert result["risk"]["classification"] == "High"
    assert not result["risk"]["alternate_local_path_available"]


def test_same_no_path_and_snap(records):
    graph = build_graph(records, GraphSettings(radius_km=12))
    same = route(
        graph, RouteRequest(origin=Point(station_id="0"), destination=Point(station_id="0"))
    )
    assert same["distance_km"] == 0
    assert same["battery"]["stops"] == 0
    no_path = route(
        graph, RouteRequest(origin=Point(station_id="0"), destination=Point(station_id="3"))
    )
    assert not no_path["found"]
    snapped = route(
        graph,
        RouteRequest(origin=Point(latitude=28.01, longitude=77), destination=Point(station_id="2")),
    )
    assert snapped["origin"]["station_id"] == "0"
    assert snapped["origin"]["snap_distance_km"] > 0
    assert snapped["origin"]["latitude"] == 28.01
    assert snapped["origin"]["snapped_latitude"] == 28


def test_colocated_zero_distance(records):
    records[1].update(latitude=28, longitude=77)
    graph = build_graph(records, GraphSettings(radius_km=12))
    assert graph.edges["0", "1"]["distance_km"] == 0
    assert all(0 <= s["pagerank"] <= 1 for s in analyze(graph)["stations"])


def test_battery_accounting_and_infeasibility():
    legs = [
        {"source": "a", "target": "b", "distance_km": 100},
        {"source": "b", "target": "c", "distance_km": 100},
    ]
    vehicle = Vehicle(capacity_kwh=30, initial_soc=70, consumption_kwh_100km=20, target_soc=90)
    result = battery_simulation(legs, ["a", "b", "c"], vehicle)
    assert result["feasible"]
    assert result["stops"] == 2
    assert result["energy_consumed_kwh"] == 40
    assert result["grid_energy_kwh"] * vehicle.charge_efficiency == pytest.approx(
        result["charging_energy_kwh"]
    )
    assert result["final_soc_pct"] / 100 * 30 == pytest.approx(
        21 + result["charging_energy_kwh"] - 40
    )
    assert not battery_simulation(
        legs, ["a", "b", "c"], vehicle.model_copy(update={"max_stops": 0})
    )["feasible"]
    too_long = [{"source": "a", "target": "b", "distance_km": 500}]
    assert not battery_simulation(too_long, ["a", "b"], vehicle)["feasible"]


def test_accessibility_weights_capability_and_missing(records):
    with pytest.raises(ValidationError):
        AccessibilityRequest(weights={"distance": 20})
    graph = build_graph(records, GraphSettings(radius_km=12))
    metadata = {
        "capabilities": {"num_chargers": False, "charging_power_kw": False},
        "availability_index": True,
    }
    result = accessibility(graph, AccessibilityRequest(), metadata)
    assert all(0 <= s["score"] <= 100 for s in result["ranking"])
    with pytest.raises(ValueError):
        accessibility(graph, AccessibilityRequest(weights={"power": 100}), metadata)
    single = accessibility(
        build_graph(records[:1], GraphSettings()), AccessibilityRequest(), metadata
    )
    assert single["ranking"][0]["inputs"]["distance"] is None
    assert single["ranking"][0]["weight_coverage_pct"] == 65


def test_removal_is_copy(records):
    graph = build_graph(records, GraphSettings(radius_km=12))
    result = resilience(graph, "1", "0")
    assert result["removed_was_articulation"]
    assert result["disconnected_stations"] == ["2"]
    assert result["before"]["components"] == 2
    assert result["after"]["components"] == 3
    assert len(graph) == 4
    assert graph.number_of_edges() == 2
    assert result["before"]["average_within_component_path_km"] > 0


def test_candidates_deterministic_and_actual_addition(records):
    graph = build_graph(records, GraphSettings(radius_km=12))
    request = ExpansionRequest(graph=GraphSettings(radius_km=12))
    one, two = expansion(graph, request), expansion(graph, request)
    assert one == two
    assert 1 <= len(one["candidates"]) <= 10
    for candidate in one["candidates"]:
        assert candidate["after"]["nodes"] == candidate["before"]["nodes"] + 1
        assert candidate["nearest_station_km"] > 0
        assert 6 <= candidate["latitude"] <= 38
    assert len(graph) == 4
    assert expansion(build_graph(records[:1], GraphSettings()), request)["candidates"] == []


def test_dbscan_and_empty(records):
    result = clusters(
        build_graph(records, GraphSettings()), ClusterRequest(radius_km=12, min_samples=2)
    )
    assert result["isolated"] == 1
    assert result["clusters"][0]["size"] == 3
    assert analyze(nx.Graph())["stations"] == []
    assert clusters(nx.Graph(), ClusterRequest())["clusters"] == []


def test_health_formula_and_empty_graph(records):
    result = analyze(build_graph(records, GraphSettings(radius_km=12)))
    health = result["summary"]["health"]
    assert sum(health["weights"].values()) == 100
    assert health["score"] == round(
        sum(health["inputs"][key] * weight for key, weight in health["weights"].items()), 2
    )
    assert analyze(nx.Graph())["summary"]["health"]["score"] is None


def test_missing_availability_is_not_zero_confidence(records):
    records[0]["availability"] = None
    request = AccessibilityRequest(weights={"availability": 50, "density": 50})
    result = accessibility(
        build_graph(records, GraphSettings()),
        request,
        {"availability_index": True, "capabilities": {}},
    )
    station = next(s for s in result["ranking"] if s["station_id"] == "0")
    assert station["inputs"]["availability"] is None
    assert station["weight_coverage_pct"] == 50


def test_single_station_removal_and_empty_expansion(records):
    graph = build_graph(records[:1], GraphSettings())
    result = resilience(graph, "0")
    assert result["after"]["nodes"] == 0
    assert result["reference_id"] is None
    assert result["after"]["average_within_component_path_km"] is None
    assert expansion(nx.Graph(), ExpansionRequest())["candidates"] == []
