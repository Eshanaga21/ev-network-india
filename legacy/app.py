import streamlit as st
from io import StringIO
import pandas as pd
from src.data_loader import load_data
from src.data_cleaning import clean_stations
from src.graph_builder import build_graph
from src.graph_analysis import analyze_graph
from src.visualization import station_map
from src.ui import apply_theme, metric_card, navigation
from src.data_loader import DATASET_METADATA

st.set_page_config(page_title="ChargeGrid | EV Network Intelligence", page_icon="⚡", layout="wide", initial_sidebar_state="expanded")
apply_theme()

@st.cache_data
def data(): return clean_stations(load_data())
@st.cache_resource
def graph(frame_json, method, distance, k): return build_graph(pd.read_json(StringIO(frame_json)), method, distance, k)

df, audit = data()
with st.sidebar:
    st.markdown("## ⚡ ChargeGrid")
    st.caption("NETWORK INTELLIGENCE LAB")
    st.divider(); st.markdown("#### Network settings")
    method = st.selectbox("Connection model", ["radius", "knn"], help="Radius connects stations within a distance; k-NN links each station to nearby neighbours.")
    distance = st.slider("Link radius (km)", 5, 100, 18, help="Used only in radius mode.")
    k = st.slider("Nearest neighbours", 1, 10, 4, help="Used only in k-NN mode.")
    st.markdown("#### Refine the view")
    states = st.multiselect("States", sorted(df.state.unique()), default=sorted(df.state.unique()))
    status_filter = st.multiselect("Recorded availability", sorted(df.status.unique()), default=sorted(df.status.unique()), help="This is the source's recorded availability field, not a live occupancy check.")
    st.divider(); st.caption("E-Amrit / NITI Aayog extract · Indian station records\n\nNo live occupancy, connector, or power data")

filtered = df[df.state.isin(states) & df.status.isin(status_filter)]
G = graph(filtered.to_json(), method, distance, k); analysis = analyze_graph(G)
st.session_state.update({"df": filtered, "G": G, "analysis": analysis, "audit": audit, "opts": {"method": method, "max_distance_km": distance, "k": k}})
m = analysis["metrics"]; reported_available = int(filtered.status.eq("Reported available").sum())

navigation()

st.markdown("""<section class="hero"><span class="eyebrow">INDIA EV NETWORK INTELLIGENCE</span><h1>Real Indian stations. Clear network decisions.</h1><p>Explore documented E-Amrit / NITI Aayog station records: topology, reachability, resilience, and geographic coverage gaps — with assumptions clearly separated from observed data.</p></section>""", unsafe_allow_html=True)
st.write("")
cards = st.columns(5)
for col, label, value, note in zip(cards,
    ["Stations in view", "Reported available", "States represented", "Network fragments", "Network links"],
    [f"{len(filtered):,}", f"{reported_available:,}", f"{filtered.state.nunique()}", m.get("components", 0), f"{G.number_of_edges():,}"],
    ["E-Amrit locator records", "Source availability field", "Current selection", "Connected components", "Geographic model"]):
    with col: metric_card(label, value, note)

st.write(""); left, right = st.columns([1.7, .8], gap="large")
with left:
    st.markdown('<p class="panel-title">Station footprint</p><p class="panel-subtitle">Bubble size represents connector count; colour shows operator.</p>', unsafe_allow_html=True)
    st.plotly_chart(station_map(filtered, title=""), use_container_width=True, config={"displayModeBar": False})
with right:
    st.markdown('<p class="panel-title">Network pulse</p><p class="panel-subtitle">A quick interpretation of the current filter.</p>', unsafe_allow_html=True)
    largest = len(analysis["components"][0]) if analysis["components"] else 0; coverage = round(100 * largest / len(G)) if len(G) else 0
    st.markdown(f'<div class="insight"><div class="metric-label">Largest connected cluster</div><div class="insight-number">{coverage}%</div><div style="color:#64748b;font-size:.86rem">{largest} of {len(G)} stations are mutually reachable under the selected model.</div></div>', unsafe_allow_html=True)
    st.markdown(f'<div class="insight"><div class="metric-label">Critical topology</div><div class="insight-number">{len(m["articulation_points"])} <span style="font-size:.85rem;color:#64748b">key stations</span></div><div style="color:#64748b;font-size:.86rem">Removing an articulation point would split its connected component.</div></div>', unsafe_allow_html=True)
    next_page = "Network Analysis" if m.get("components", 0) <= 1 else "Network Analysis → inspect disconnected clusters"
    st.markdown(f'<div class="insight"><div class="metric-label">Suggested next step</div><div style="font-weight:800;color:#14213d;margin:8px 0">{next_page}</div><div style="color:#64748b;font-size:.86rem">Use the sidebar pages to investigate topology, routes, accessibility, and candidate sites.</div></div>', unsafe_allow_html=True)
with st.expander("Data source, quality & modelling assumptions"):
    st.markdown(f"**Source:** [{DATASET_METADATA['source']}]({DATASET_METADATA['url']})  \\n+**Extract:** {DATASET_METADATA['extract']} · retrieved {DATASET_METADATA['retrieved']}  \\n+**Coverage:** {DATASET_METADATA['coverage']}  \\n+**Known limitation:** {DATASET_METADATA['limitations']}")
    st.json(audit)
