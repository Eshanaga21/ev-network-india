import streamlit as st
import plotly.express as px
from src.accessibility import accessibility_scores
from src.ui import apply_theme, page_header, metric_card
from src.session import ensure_context

ensure_context(); apply_theme(); page_header("ACCESSIBILITY INDEX", "Find geographic coverage gaps", "This relative index is calculated from the filtered E-Amrit India station records. Change the weights to inspect how your stated priorities affect results.")
df=st.session_state.df; G=st.session_state.G
with st.expander("Index configuration",expanded=True):
    a,b,c,d=st.columns(4)
    distance=a.slider("Distance weight",0,100,40)/100; density=b.slider("Nearby-station weight",0,100,30)/100; availability=c.slider("Recorded availability weight",0,100,15)/100; connectivity=d.slider("Connectivity weight",0,100,15)/100
    total=distance+density+availability+connectivity
    st.caption(f"Current total: {total:.2f}. Scores require weights that sum to 1.00.")
if round(total,6)!=1:
    st.warning("Set the four weights to exactly 100% in total to calculate the index."); st.stop()
scores=accessibility_scores(df,G,{"distance":distance,"density":density,"availability":availability,"connectivity":connectivity})
out=df.merge(scores,on=["station_id","city"])
a,b,c=st.columns(3)
with a: metric_card("Average index",f"{out.accessibility_score.mean():.1f}","Within current filter")
with b: metric_card("Lowest index",f"{out.accessibility_score.min():.1f}","Coverage priority")
with c: metric_card("Average nearest station",f"{out.nearest_station_km.mean():.1f} km","Haversine distance")
st.plotly_chart(px.scatter_map(out,lat="latitude",lon="longitude",color="accessibility_score",size="nearby_stations",hover_name="station_name",hover_data=["nearest_station_km","reported_available","degree"],color_continuous_scale="RdYlGn",zoom=4,height=550,map_style="carto-positron",title="Relative accessibility index"),use_container_width=True)
st.subheader("Lowest-accessibility station areas")
st.dataframe(out.sort_values("accessibility_score")[['station_name','city','accessibility_score','classification','nearest_station_km','nearby_stations','reported_available','degree']],use_container_width=True,hide_index=True)
