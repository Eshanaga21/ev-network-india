from src.data_loader import load_data
from src.data_cleaning import clean_stations
from src.graph_builder import build_graph
from src.resilience import failure_impact

def test_failure_simulation_reports_before_after():
    df,_=clean_stations(load_data()); graph=build_graph(df.head(20),method="knn",k=2)
    result=failure_impact(graph,next(iter(graph)))
    assert result["after_components"] >= 1
    assert 0 <= result["after_density"] <= 1
