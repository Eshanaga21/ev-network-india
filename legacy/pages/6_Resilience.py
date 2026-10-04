import streamlit as st
from src.resilience import failure_impact, impact_table
from src.ui import apply_theme, page_header, metric_card
from src.session import ensure_context

ensure_context(); apply_theme(); page_header("RESILIENCE LAB", "What if a station goes offline?", "Remove a real station node and recompute connectivity, density, reachability, and average in-component travel distance.")
G=st.session_state.G; analysis=st.session_state.analysis
if not G: st.warning("No stations match the current filters."); st.stop()
critical=set(analysis["metrics"]["articulation_points"])
station=st.selectbox("Station to remove",list(G.nodes),format_func=lambda x:f"{'⚠ ' if x in critical else ''}{G.nodes[x]['station_name']} — {x}")
impact=failure_impact(G,station)
a,b,c,d=st.columns(4)
for col,label,value,note in [(a,"Components after",impact['after_components'],"Before: "+str(impact['before_components'])),(b,"Reachable after",impact['reachable_after'],"From largest remaining cluster"),(c,"Disconnected after",impact['disconnected_after'],"Outside largest remaining cluster"),(d,"Density after",f"{impact['after_density']:.3f}","Before: "+f"{impact['before_density']:.3f}")]:
    with col: metric_card(label,value,note)
if station in critical: st.error("This station is an articulation point in the current graph: removing it fragments at least one connected component.")
else: st.success("This station is not an articulation point in the current graph. Its removal may still reduce route choices and network density.")
st.subheader("Before / after topology")
st.dataframe(impact_table(impact),use_container_width=True,hide_index=True)
st.caption("Average shortest path is calculated only within connected components; disconnected pairs are not assigned a fabricated distance.")
