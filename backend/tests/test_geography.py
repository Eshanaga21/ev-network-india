from backend.geography import in_requested_region, in_ring
from backend.regions import regional_dataset


def test_cartographic_region_accepts_regional_points_and_rejects_clear_conflicts():
    for lat, lon in [
        (28.6139, 77.2090),
        (26.9124, 75.7873),
        (22.7196, 75.8577),
        (31.6339, 74.8723),
    ]:
        assert in_requested_region(lat, lon)
    assert not in_requested_region(12.9716, 77.5946)
    assert not in_requested_region(9.9312, 76.2673)
    assert in_ring(1, 1, [[0, 0], [2, 0], [2, 2], [0, 2], [0, 0]])
    assert not in_ring(3, 1, [[0, 0], [2, 0], [2, 2], [0, 2], [0, 0]])


def test_conflicting_source_state_is_flagged_without_repairing_snapshot(records):
    records[0].update(state="Delhi", latitude=12.9716, longitude=77.5946, source_row=1)
    for index, record in enumerate(records[1:], 2):
        record["source_row"] = index
    source = {"stations": records, "metadata": {"capabilities": {"availability": True}}}
    result = regional_dataset(source)
    assert result["metadata"]["state_label_matches"] == 4
    assert result["metadata"]["geographic_conflicts_excluded"] == 1
    assert result["metadata"]["regional_records"] == 3
    assert result["metadata"]["geographic_conflicts"][0]["source_state"] == "Delhi"
    assert records[0]["state"] == "Delhi"
    assert records[0]["latitude"] == 12.9716
