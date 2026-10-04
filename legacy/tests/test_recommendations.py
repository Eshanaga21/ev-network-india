from src.data_loader import load_data
from src.data_cleaning import clean_stations
from src.station_recommendation import recommend_locations
def test_candidates_are_ranked():
    df,_=clean_stations(load_data()); candidates=recommend_locations(df.head(40),top_n=4)
    assert len(candidates)==4 and candidates.recommendation_score.is_monotonic_decreasing
