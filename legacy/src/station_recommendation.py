import pandas as pd
import numpy as np
from .utils import haversine_km
from .graph_builder import build_graph
from .graph_analysis import analyze_graph

def recommend_locations(df, grid=5, top_n=10):
    """Rank deterministic midpoints of real station pairs as coverage-gap candidates.

    No demand, traffic, roads, or land suitability is inferred from this data.
    """
    rows=[]; records=list(df.itertuples())
    for i,a in enumerate(records):
      for b in records[i+1:]:
        pair_distance=haversine_km(a.latitude,a.longitude,b.latitude,b.longitude)
        if not 8 <= pair_distance <= 60: continue
        lat,lon=(a.latitude+b.latitude)/2,(a.longitude+b.longitude)/2
        d=[haversine_km(lat,lon,r.latitude,r.longitude) for r in records]; nearest=min(d); near=sum(x<=18 for x in d)
        score=nearest + pair_distance*.35 - near*2
        rows.append({"latitude":lat,"longitude":lon,"nearby_stations":near,"nearest_station_km":nearest,"estimated_coverage_improvement":nearest,"recommendation_score":score,"reason":"Midpoint of a real station gap; score prioritises distance from the nearest recorded station."})
    return pd.DataFrame(rows).drop_duplicates(["latitude","longitude"]).sort_values("recommendation_score",ascending=False).head(top_n).reset_index(drop=True)

def simulate_addition(df, candidate, **graph_options):
    before=analyze_graph(build_graph(df,**graph_options))["metrics"]
    new=df.copy(); new.loc[len(new)]={**df.iloc[0].to_dict(),"station_id":"PROPOSED","station_name":"Proposed candidate (modeled)","latitude":candidate.latitude,"longitude":candidate.longitude,"num_chargers":0,"fast_chargers":0,"level2_chargers":0,"charging_power_kw":None}
    after=analyze_graph(build_graph(new,**graph_options))["metrics"]
    return pd.DataFrame([{"metric":"Connected components","before":before["components"],"after":after["components"]},{"metric":"Network density","before":before["density"],"after":after["density"]},{"metric":"Network connections","before":before["edges"],"after":after["edges"]}])
