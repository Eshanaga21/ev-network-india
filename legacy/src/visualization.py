import pandas as pd
import plotly.express as px
import plotly.graph_objects as go

def station_map(df, color="operator", title="Charging stations"):
    fig=px.scatter_map(df,lat="latitude",lon="longitude",color=color,size="num_chargers",hover_name="station_name",hover_data=["city","charging_power_kw","status"],zoom=5,height=520,title=title,map_style="carto-positron",color_discrete_sequence=["#2563eb","#10b981","#f59e0b","#8b5cf6"])
    fig.update_layout(margin={"l":0,"r":0,"t":42,"b":0},paper_bgcolor="white",font={"family":"Inter, Arial"},legend_title_text="")
    return fig

def network_figure(G, metric="degree"):
    edge_lon=[];edge_lat=[]
    for a,b in G.edges:
        edge_lon += [G.nodes[a]["longitude"],G.nodes[b]["longitude"],None]; edge_lat += [G.nodes[a]["latitude"],G.nodes[b]["latitude"],None]
    fig=go.Figure(go.Scattermap(mode="lines",lon=edge_lon,lat=edge_lat,line={"width":1,"color":"#94a3b8"},hoverinfo="skip",name="Connections"))
    vals=[]
    for n in G:
        d=G.nodes[n]
        vals.append({"degree":G.degree(n),"charging_ports":d["num_chargers"],"degree_centrality":d.get("degree_centrality",0),"betweenness":d.get("betweenness",0),"closeness":d.get("closeness",0),"pagerank":d.get("pagerank",0)}.get(metric,G.degree(n)))
    fig.add_trace(go.Scattermap(mode="markers",lon=[G.nodes[n]["longitude"] for n in G],lat=[G.nodes[n]["latitude"] for n in G],text=[f"<b>{G.nodes[n]['station_name']}</b><br>Degree: {G.degree(n)}" for n in G],hoverinfo="text",marker={"size":[8+min(20,v) for v in vals],"color":vals,"colorscale":"Viridis","showscale":True},name="Stations"))
    fig.update_layout(map_style="carto-positron",map_zoom=5,height=590,margin={"l":0,"r":0,"t":35,"b":0},title="Weighted geographic network")
    return fig

def route_map(G, result):
    df=pd.DataFrame([d for _,d in G.nodes(data=True)]); fig=station_map(df,title="Optimized route")
    if result and len(result["path"])>1:
        p=result["path"]; fig.add_trace(go.Scattermap(mode="lines+markers",lon=[G.nodes[n]["longitude"] for n in p],lat=[G.nodes[n]["latitude"] for n in p],line={"width":5,"color":"#ef4444"},marker={"size":9},name="Route"))
    return fig
