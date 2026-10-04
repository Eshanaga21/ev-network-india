"""Measured shortest-path and EV energy models."""
from time import perf_counter
import networkx as nx
from .utils import haversine_km

def _result(G, path, weight, runtime_ms, algorithm):
    edges=[G.edges[a,b] for a,b in zip(path,path[1:])]
    return {"algorithm":algorithm,"path":path,"distance_km":sum(e["distance_km"] for e in edges),"travel_time_min":sum(e["travel_time_min"] for e in edges),"cost":sum(e[weight] for e in edges),"charging_stops":max(0,len(path)-2),"runtime_ms":runtime_ms}

def route(G, start, end, mode="shortest", algorithm="dijkstra"):
    if start==end: return {"algorithm":algorithm,"path":[start],"distance_km":0,"travel_time_min":0,"cost":0,"charging_stops":0,"runtime_ms":0.0}
    weight="distance_km" if mode=="shortest" else "route_cost"
    try:
        begun=perf_counter()
        if algorithm=="astar":
            heuristic=lambda a,b: haversine_km(G.nodes[a]["latitude"],G.nodes[a]["longitude"],G.nodes[b]["latitude"],G.nodes[b]["longitude"])
            path=nx.astar_path(G,start,end,heuristic=heuristic,weight=weight)
        else: path=nx.dijkstra_path(G,start,end,weight=weight)
        return _result(G,path,weight,(perf_counter()-begun)*1000,algorithm.title())
    except (nx.NetworkXNoPath,nx.NodeNotFound): return None

def ev_trip_simulation(G, result, battery_kwh, start_pct, efficiency_kwh_per_100km, reserve_pct, target_pct, max_stops, assumed_dc_power_kw=50, efficiency=.90):
    """Sequential SOC model. Charger power is user supplied because AFDC lacks kW."""
    if result is None: return {"feasible":False,"reason":"No route exists in the selected geographic network."}
    energy=battery_kwh*start_pct/100; reserve=battery_kwh*reserve_pct/100; target=battery_kwh*target_pct/100
    events=[]; charge_time=0; stops=0
    for a,b in zip(result["path"],result["path"][1:]):
        distance=G.edges[a,b]["distance_km"]; used=distance*efficiency_kwh_per_100km/100
        if energy-used < reserve:
            if stops >= max_stops: return {"feasible":False,"reason":"Maximum charging stops reached before maintaining reserve.","events":events}
            delivered=max(0,target-energy); minutes=delivered/(assumed_dc_power_kw*efficiency)*60
            charge_time+=minutes; stops+=1; energy+=delivered
            events.append({"station_id":a,"action":"Charge (modeled)","energy_added_kwh":round(delivered,2),"minutes":round(minutes,1)})
        energy-=used; events.append({"station_id":b,"action":"Drive","distance_km":round(distance,2),"battery_pct":round(100*energy/battery_kwh,1)})
    return {"feasible":energy>=reserve,"final_battery_pct":round(100*energy/battery_kwh,1),"estimated_charging_energy_kwh":round(sum(e.get("energy_added_kwh",0) for e in events),2),"estimated_charging_time_min":round(charge_time,1),"charging_stops":stops,"events":events,"assumption":"Energy use is constant. Charging uses the user-supplied power and 90% efficiency; taper, traffic, elevation, and live availability are not modeled."}
