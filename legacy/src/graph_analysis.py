import networkx as nx
import pandas as pd

def analyze_graph(G):
    if not G: return {"metrics":{},"rankings":pd.DataFrame(),"components":[]}
    degree=dict(G.degree()); weighted=dict(G.degree(weight="distance_km"))
    bet=nx.betweenness_centrality(G,weight="distance_km") if len(G)>1 else {n:0 for n in G}
    close=nx.closeness_centrality(G,distance="distance_km") if len(G)>1 else {n:0 for n in G}
    pr=nx.pagerank(G,weight="distance_km") if len(G)>1 else {n:1 for n in G}
    rows=[]
    degree_centrality=nx.degree_centrality(G) if len(G)>1 else {n:0 for n in G}
    for n,d in G.nodes(data=True):
        G.nodes[n].update(degree_centrality=degree_centrality[n],betweenness=bet[n],closeness=close[n],pagerank=pr[n])
        rows.append({"station_id":n,"station_name":d["station_name"],"city":d["city"],"degree":degree[n],"weighted_degree_km":weighted[n],"degree_centrality":degree_centrality[n],"betweenness":bet[n],"closeness":close[n],"pagerank":pr[n],"charging_ports":d["num_chargers"],"dc_fast_ports":d.get("fast_chargers",0)})
    comps=sorted((list(c) for c in nx.connected_components(G)),key=len,reverse=True)
    metrics={"nodes":len(G),"edges":G.number_of_edges(),"density":nx.density(G),"components":len(comps),"bridges":list(nx.bridges(G)),"articulation_points":list(nx.articulation_points(G))}
    return {"metrics":metrics,"rankings":pd.DataFrame(rows).sort_values("betweenness",ascending=False),"components":comps}
