import networkx as nx
from .utils import haversine_km

def build_graph(df, method="radius", max_distance_km=18, k=4, speed_kmph=45):
    """Build an explicit geographic-proximity graph from real station coordinates.

    Edges are not roads: they are plausible station-to-station travel links based
    on Haversine separation. Travel time uses a disclosed 45 km/h model because
    the offline extract contains no road-network distances.
    """
    G=nx.Graph()
    for r in df.to_dict("records"): G.add_node(r["station_id"], **r)
    ids=df.station_id.tolist()
    for i in range(len(df)):
        distances=[]
        for j in range(i+1,len(df)):
            a,b=df.iloc[i],df.iloc[j]; d=haversine_km(a.latitude,a.longitude,b.latitude,b.longitude); distances.append((d,j))
            if method=="radius" and d<=max_distance_km: _edge(G,ids[i],ids[j],d,speed_kmph)
        if method=="knn":
            for d,j in sorted(distances)[:k]: _edge(G,ids[i],ids[j],d,speed_kmph)
    return G

def _edge(G,u,v,d,speed):
    # EV cost favours documented DC fast-port availability, not invented kW.
    fast=min(G.nodes[u].get("fast_chargers",0),G.nodes[v].get("fast_chargers",0))
    G.add_edge(u, v, distance_km=d, travel_time_min=d/speed*60, route_cost=d*(1 + (0.12 if fast == 0 else 0)))

def adjacency_rows(G, node):
    return [{"station_id":n,"station_name":G.nodes[n]["station_name"],"distance_km":round(e["distance_km"],2)} for n,e in G[node].items()]
