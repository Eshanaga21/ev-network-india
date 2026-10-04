import pandas as pd
from src.data_cleaning import clean_stations
def test_cleaning_removes_bad_coords_and_duplicates():
    raw=pd.DataFrame([{"station_id":"a","latitude":12,"longitude":77},{"station_id":"a","latitude":12,"longitude":77},{"station_id":"b","latitude":200,"longitude":77}])
    clean,audit=clean_stations(raw)
    assert len(clean)==1 and audit["duplicate_ids_removed"]==1 and audit["invalid_coordinates_removed"]==1
