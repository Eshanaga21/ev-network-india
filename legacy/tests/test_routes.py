import networkx as nx
from src.route_optimizer import route
def test_dijkstra_and_same_node():
    g=nx.Graph(); g.add_edge("a","b",distance_km=3,travel_time_min=4,route_cost=3); g.add_node("a",num_chargers=1,latitude=0,longitude=0); g.add_node("b",num_chargers=1,latitude=0,longitude=.02)
    assert route(g,"a","b")["distance_km"]==3
    assert route(g,"a","a")["path"]==["a"]
    assert route(g,"a","b",algorithm="astar")["path"]==["a","b"]
