import streamlit as st
import plotly.express as px
from src.visualization import station_map
from src.ui import apply_theme, page_header
from src.session import ensure_context
ensure_context(); apply_theme(); page_header("NETWORK EXPLORER", "Infrastructure at a glance", "Understand where charging capacity sits and how it is distributed across the selected network.")
df=st.session_state.df; G=st.session_state.G
st.plotly_chart(station_map(df),use_container_width=True)
a,b=st.columns(2)
a.plotly_chart(px.bar(df.groupby("state",as_index=False).size(),x="state",y="size",title="Stations by state",color_discrete_sequence=["#2563eb"]),use_container_width=True)
b.plotly_chart(px.bar(df.groupby("status",as_index=False).size(),x="status",y="size",title="Recorded availability status",color_discrete_sequence=["#10b981"]),use_container_width=True)
c,d=st.columns(2)
c.plotly_chart(px.bar(df.groupby("city",as_index=False).size().sort_values("size",ascending=False).head(12),x="city",y="size",title="Top cities by recorded stations"),use_container_width=True)
d.plotly_chart(px.scatter(df,x="longitude",y="latitude",color="status",hover_name="station_name",title="Spatial distribution of Indian station records"),use_container_width=True)
