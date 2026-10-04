from pathlib import Path
import pandas as pd

RAW_PATH = Path(__file__).parents[1] / "data/raw/eamrit_india_charging_stations.json"

DATASET_METADATA = {
    "source": "E-Amrit / NITI Aayog Charging Station Locator",
    "extract": "160-record public India station-locator extract",
    "retrieved": "2026-09-10",
    "coverage": "India: records across Delhi, Uttar Pradesh, Tamil Nadu, West Bengal, Kerala, Goa and other listed states; this is the endpoint response, not a national census.",
    "limitations": "The source provides station coordinates and a recorded availability field, but does not provide connector, port-count, charging-power, session, or real-time occupancy data.",
    "url": "https://e-amrit.niti.gov.in/charging-station-locators",
}

def load_data(path=None):
    target = Path(path) if path is not None else RAW_PATH
    if not target.exists():
        raise FileNotFoundError(f"Required E-Amrit India offline extract is missing: {target}")
    return pd.read_json(target) if target.suffix.lower()==".json" else pd.read_csv(target)
