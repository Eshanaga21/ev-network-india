import streamlit as st
from src.visualization import network_figure
from src.graph_builder import adjacency_rows
from src.ui import apply_theme, page_header, metric_card
from src.session import ensure_context
ensure_context(); apply_theme(); page_header("GRAPH LAB", "Network resilience", "Inspect the weighted graph behind the charging network and uncover the stations and links that matter most.")
G=st.session_state.G; a=st.session_state.analysis; df=st.session_state.df
st.info("G = (V, E): stations are nodes; sparse geographic links are weighted edges. Every edge stores distance, estimated travel time, and EV route cost.")
metric=st.selectbox("Node colour & size metric",["charging_ports","degree_centrality","betweenness","closeness","pagerank","degree"]); st.plotly_chart(network_figure(G,metric),use_container_width=True)
m=a["metrics"]; c=st.columns(3)
with c[0]: metric_card("Network density",f"{m['density']:.3f}","Observed vs. possible links")
with c[1]: metric_card("Bridge links",len(m["bridges"]),"Critical connections")
with c[2]: metric_card("Key stations",len(m["articulation_points"]),"Removal splits a cluster")
rank_metric=st.selectbox("Rank stations by",["betweenness","degree_centrality","closeness","pagerank","charging_ports"])
st.subheader("Centrality ranking"); st.dataframe(a["rankings"].sort_values(rank_metric,ascending=False),use_container_width=True,hide_index=True)
station=st.selectbox("Inspect adjacency list",df.station_id,format_func=lambda x: f"{x} — {G.nodes[x]['station_name']}")
st.dataframe(adjacency_rows(G,station),use_container_width=True,hide_index=True)
