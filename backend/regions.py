"""The six-state application scope; source snapshots are never rewritten."""

from collections import Counter

from backend.geography import BORDER_TOLERANCE_KM, in_requested_region

REGIONS = ("Uttar Pradesh", "Delhi", "Rajasthan", "Haryana", "Punjab", "Madhya Pradesh")
ALIASES = {
    "up": "Uttar Pradesh",
    "u.p.": "Uttar Pradesh",
    "uttar pradesh": "Uttar Pradesh",
    "delhi": "Delhi",
    "new delhi": "Delhi",
    "nct of delhi": "Delhi",
    "delhi nct": "Delhi",
    "rajasthan": "Rajasthan",
    "haryana": "Haryana",
    "harayana": "Haryana",
    "punjab": "Punjab",
    "mp": "Madhya Pradesh",
    "m.p.": "Madhya Pradesh",
    "madhya pradesh": "Madhya Pradesh",
}


def canonical_state(value):
    return ALIASES.get(str(value or "").strip().lower())


def regional_dataset(dataset):
    labeled = [s for s in dataset["stations"] if canonical_state(s["state"]) in REGIONS]
    conflicts = [s for s in labeled if not in_requested_region(s["latitude"], s["longitude"])]
    stations = [
        {**s, "state": canonical_state(s["state"]), "source_state": s["state"]}
        for s in labeled
        if in_requested_region(s["latitude"], s["longitude"])
    ]
    counts = Counter(s["state"] for s in stations)
    availability = {
        str(s["availability"]).lower() for s in stations if s.get("availability") is not None
    }
    metadata = {
        **dataset["metadata"],
        "source_capabilities": dataset["metadata"]["capabilities"],
        "capabilities": {
            key: any(s.get(key) is not None for s in stations)
            for key in dataset["metadata"]["capabilities"]
        },
        "availability_index": bool(availability)
        and availability <= {"1", "1.0", "0", "0.0", "available", "unavailable", "true", "false"},
        "regional_scope": list(REGIONS),
        "regional_records": len(stations),
        "regional_counts": {state: counts[state] for state in REGIONS},
        "outside_scope_records": len(dataset["stations"]) - len(stations),
        "state_label_matches": len(labeled),
        "geographic_conflicts_excluded": len(conflicts),
        "geographic_conflicts": [
            {
                "station_id": s["station_id"],
                "source_row": s["source_row"],
                "station_name": s["station_name"],
                "source_state": s["state"],
                "latitude": s["latitude"],
                "longitude": s["longitude"],
            }
            for s in conflicts
        ],
        "scope_coordinate_check": f"Source state label plus location within the six-state Natural Earth cartographic region or {BORDER_TOLERANCE_KM} km of its border. Not official boundary validation; source coordinates and states are never repaired or inferred.",
    }
    return {**dataset, "metadata": metadata, "stations": stations}
