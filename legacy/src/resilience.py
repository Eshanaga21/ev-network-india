import networkx as nx
import pandas as pd

def _average_path(G):
    if len(G) < 2: return 0.0
    values=[]
    for component in nx.connected_components(G):
        sub=G.subgraph(component)
        if len(sub)>1: values.append(nx.average_shortest_path_length(sub, weight="distance_km"))
    return sum(values)/len(values) if values else 0.0

def failure_impact(G, station_id):
    """Calculate real topology changes caused by removing an actual station node."""
    if station_id not in G: raise nx.NodeNotFound(station_id)
    before_components=list(nx.connected_components(G)); before_reachable=len(nx.node_connected_component(G,station_id))-1
    H=G.copy(); H.remove_node(station_id)
    comps=list(nx.connected_components(H)) if H else []
    largest=max((len(c) for c in comps),default=0)
    return {"station_id":station_id,"before_components":len(before_components),"after_components":len(comps),"before_density":nx.density(G),"after_density":nx.density(H),"before_avg_path_km":_average_path(G),"after_avg_path_km":_average_path(H),"reachable_before":before_reachable,"reachable_after":max(0,largest-1),"disconnected_after":max(0,len(H)-largest)}

def impact_table(impact):
    labels={"before_components":"Connected components","before_density":"Network density","before_avg_path_km":"Average in-component path (km)","reachable_before":"Reachable stations"}
    rows=[]
    for before,label in labels.items():
        after=before.replace("before_","after_") if before.startswith("before_") else before.replace("before","after")
        if after in impact: rows.append({"metric":label,"before":round(impact[before],3),"after":round(impact[after],3)})
    rows.append({"metric":"Stations outside largest remaining component","before":0,"after":impact["disconnected_after"]})
    return pd.DataFrame(rows)
