import pandas as pd
from .utils import haversine_km

def accessibility_scores(df, G, weights=None, radius_km=15):
    """Transparent, relative accessibility index for the loaded station sample."""
    weights=weights or {"distance":.40,"density":.30,"availability":.15,"connectivity":.15}
    if round(sum(weights.values()),6) != 1: raise ValueError("Accessibility weights must sum to 1")
    rows=[]
    for _,r in df.iterrows():
        ds=[haversine_km(r.latitude,r.longitude,o.latitude,o.longitude) for _,o in df.iterrows() if o.station_id!=r.station_id]
        nearest=min(ds) if ds else 0; nearby=sum(d<=radius_km for d in ds); available=int(r.status=="Reported available"); degree=G.degree(r.station_id)
        rows.append({"station_id":r.station_id,"city":r.city,"nearest_station_km":nearest,"nearby_stations":nearby,"reported_available":available,"degree":degree})
    out=pd.DataFrame(rows)
    if len(out)>1:
        norm=lambda s: (s-s.min())/(s.max()-s.min()) if s.max()!=s.min() else s*0+1
        out["accessibility_score"]=(100*(weights["distance"]*(1-norm(out.nearest_station_km))+weights["density"]*norm(out.nearby_stations)+weights["availability"]*norm(out.reported_available)+weights["connectivity"]*norm(out.degree))).round(1)
    else: out["accessibility_score"]=50
    out["classification"]=pd.cut(out.accessibility_score,[-1,19,39,59,79,100],labels=["Very Poor","Poor","Moderate","Good","Excellent"])
    return out
