import streamlit as st
import pandas as pd
from src.route_optimizer import route, ev_trip_simulation
from src.visualization import route_map
from src.ui import apply_theme, page_header, metric_card
from src.session import ensure_context

ensure_context(); apply_theme(); page_header("ROUTE ENGINE", "Measured shortest-path comparison", "Dijkstra and A* run on the same current geographic graph. Timings are measured during this request; travel time is a 45 km/h model estimate.")
G=st.session_state.G
if len(G)<2: st.warning("Choose filters that leave at least two stations."); st.stop()
ids=list(G.nodes); labels=lambda x:f"{x} — {G.nodes[x]['station_name']}"
a,b=st.columns(2); start=a.selectbox("Origin",ids,format_func=labels); end=b.selectbox("Destination",ids,index=min(1,len(ids)-1),format_func=labels)
dijkstra=route(G,start,end,"shortest","dijkstra"); astar=route(G,start,end,"shortest","astar"); ev=route(G,start,end,"ev","dijkstra")
if not dijkstra: st.error("No route exists for the current proximity graph. Increase the radius or use k-NN."); st.stop()
st.subheader("Shortest-distance algorithms")
c,d=st.columns(2)
for col, result in [(c,dijkstra),(d,astar)]:
    col.markdown(f"#### {result['algorithm']}"); x,y,z=col.columns(3)
    with x: metric_card("Distance",f"{result['distance_km']:.1f} km")
    with y: metric_card("Runtime",f"{result['runtime_ms']:.3f} ms")
    with z: metric_card("Edges",len(result["path"])-1)
    col.caption(" → ".join(result["path"]))
st.info("For distance weights, the straight-line Haversine estimate is admissible as A*'s heuristic. Both algorithms therefore return the same optimal distance when a path exists; A* may search fewer nodes.")
st.plotly_chart(route_map(G,dijkstra),use_container_width=True)
st.subheader("EV energy feasibility — modeled inputs")
st.caption("The E-Amrit extract does not include per-port kW, battery SOC, connector, or charging-curve data. The controls below are explicit assumptions, not observed measurements.")
x,y,z,w=st.columns(4); cap=x.number_input("Battery capacity (kWh)",20.,150.,75.); pct=y.slider("Starting SOC (%)",1,100,80); eff=z.number_input("Consumption (kWh/100 km)",8.,35.,18.); reserve=w.slider("Minimum reserve (%)",0,50,15)
x,y,z,w=st.columns(4); target=x.slider("Charge target SOC (%)",50,100,80); power=y.number_input("Assumed charging power (kW)",10.,350.,50.); max_stops=z.slider("Maximum charge stops",0,10,3); _=w.write("No connector or kW data is available, so station choice uses geographic distance only.")
simulation=ev_trip_simulation(G,ev,cap,pct,eff,reserve,target,max_stops,power)
if simulation["feasible"]:
    a,b,c,d=st.columns(4)
    for col,label,value in [(a,"Feasible","Yes"),(b,"Final SOC",f"{simulation['final_battery_pct']}%"),(c,"Charging energy",f"{simulation['estimated_charging_energy_kwh']} kWh"),(d,"Charging time",f"{simulation['estimated_charging_time_min']} min")]:
        with col: metric_card(label,value,"Modeled estimate")
    st.dataframe(pd.DataFrame(simulation["events"]),use_container_width=True,hide_index=True)
else: st.warning(simulation.get("reason","The route is not feasible under the selected assumptions."))
st.caption(simulation.get("assumption",""))
