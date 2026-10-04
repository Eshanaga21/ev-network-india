"""Safe page initialization for direct Streamlit page URLs."""
import streamlit as st
from .data_loader import load_data
from .data_cleaning import clean_stations
from .graph_builder import build_graph
from .graph_analysis import analyze_graph

def ensure_context():
    if "G" in st.session_state and "df" in st.session_state: return
    df,audit=clean_stations(load_data())
    G=build_graph(df, method="radius", max_distance_km=18, k=4)
    st.session_state.update({"df":df,"G":G,"analysis":analyze_graph(G),"audit":audit,"opts":{"method":"radius","max_distance_km":18,"k":4}})
