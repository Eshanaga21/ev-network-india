from src.data_loader import load_data
from src.data_cleaning import clean_stations
from src.graph_builder import build_graph
def test_graph_has_weighted_edges():
    df,_=clean_stations(load_data()); df=df.head(20); g=build_graph(df,method="knn",k=2)
    assert len(g)==len(df) and g.number_of_edges()>0
    assert {"distance_km","travel_time_min","route_cost"} <= set(next(iter(g.edges(data=True)))[2])
