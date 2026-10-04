import streamlit as st
import plotly.express as px
from src.station_recommendation import recommend_locations,simulate_addition
from src.ui import apply_theme, page_header
from src.session import ensure_context
ensure_context(); apply_theme(); page_header("GROWTH SCENARIOS", "Place the next station with intent", "Test geographic coverage candidates and compare the network before and after a proposed addition.")
df=st.session_state.df
rec=recommend_locations(df); st.warning("These are geographic-gap candidates calculated from the loaded E-Amrit Indian station coordinates. They exclude demand, roads, land, grid capacity, costs, and real-time availability; do not use them as infrastructure investment decisions.")
st.dataframe(rec.round(2),use_container_width=True,hide_index=True)
st.plotly_chart(px.scatter_map(rec,lat="latitude",lon="longitude",color="recommendation_score",size="recommendation_score",hover_data=["nearest_station_km","reason"],zoom=5,height=500,map_style="carto-positron",title="Candidate locations"),use_container_width=True)
idx=st.selectbox("Simulate candidate addition",range(len(rec)),format_func=lambda i:f"Candidate {i+1} (score {rec.iloc[i].recommendation_score:.1f})")
st.subheader("Before vs after (graph heuristic)"); st.dataframe(simulate_addition(df,rec.iloc[idx],**st.session_state.opts),use_container_width=True,hide_index=True)
