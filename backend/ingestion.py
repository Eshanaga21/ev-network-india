"""Source-aware normalization. Missing observations remain null."""

import hashlib
import io
import json
import math
from datetime import datetime, timezone

import pandas as pd

FIELDS = [
    "station_id",
    "station_name",
    "latitude",
    "longitude",
    "city",
    "state",
    "country",
    "operator",
    "status",
    "availability",
    "connector_type",
    "num_chargers",
    "charging_power_kw",
    "tariff_inr_per_kwh",
    "address",
    "source_type",
]
ALIASES = {
    "stationid": "station_id",
    "id": "station_id",
    "name": "station_name",
    "lattitude": "latitude",
    "lat": "latitude",
    "lon": "longitude",
    "lng": "longitude",
    "station name": "station_name",
    "ev network": "operator",
    "type": "source_type",
}
MAX_RECORDS = 2000


def read_records(content: bytes, filename: str) -> list[dict]:
    if len(content) > 15 * 1024 * 1024:
        raise ValueError("Maximum file size is 15 MB.")
    if filename.lower().endswith(".csv"):
        frame = pd.read_csv(io.BytesIO(content), dtype=str, keep_default_na=False)
        return frame.to_dict("records")
    if filename.lower().endswith(".json"):
        records = json.loads(content)
        if isinstance(records, dict):
            records = records.get("stations", records.get("data"))
        if not isinstance(records, list) or not all(isinstance(r, dict) for r in records):
            raise ValueError(
                "JSON must contain an array of station objects (or data/stations array)."
            )
        return records
    raise ValueError("Upload CSV or JSON.")


def clean(value):
    if value is None:
        return None
    if isinstance(value, (dict, list)):
        return json.dumps(value, ensure_ascii=False)
    text = str(value).strip()
    if text.lower() in {"", "null", "none", "nan", "n/a", "na", "unknown"}:
        return None
    return text


def numeric(value):
    try:
        number = float(value)
        return number if math.isfinite(number) else None
    except (TypeError, ValueError):
        return None


def normalize(
    content,
    filename,
    mapping=None,
    source_name="User upload",
    source_url=None,
    generate_missing_ids=False,
):
    raw = read_records(content, filename)
    if not raw:
        raise ValueError("The dataset contains no records.")
    if len(raw) > MAX_RECORDS:
        raise ValueError(f"Local import limit: {MAX_RECORDS} records. Split the dataset.")
    columns = list(dict.fromkeys(key for record in raw for key in record))
    # Explicit mapping uses standardized field -> original column.
    auto = {
        field: next(
            (col for col in columns if ALIASES.get(col.lower(), col.lower()) == field), None
        )
        for field in FIELDS
    }
    mapping = {**auto, **(mapping or {})}
    if set(mapping) - set(FIELDS) or any(v and v not in columns for v in mapping.values()):
        raise ValueError("Column mapping contains unknown fields or columns.")
    stations, rejected, duplicates, warnings = [], [], [], []
    seen = set()
    for index, record in enumerate(raw):
        row = {
            field: clean(record.get(mapping[field])) if mapping.get(field) else None
            for field in FIELDS
        }
        identity_origin = "source"
        if not row["station_id"] and generate_missing_ids:
            identity = json.dumps(
                {key: clean(value) for key, value in record.items()},
                sort_keys=True,
                ensure_ascii=False,
                separators=(",", ":"),
            )
            row["station_id"] = "record:" + hashlib.sha256(identity.encode()).hexdigest()
            identity_origin = "derived record hash"
        lat, lon = numeric(row["latitude"]), numeric(row["longitude"])
        reason = None
        if lat is None or lon is None or not (-90 <= lat <= 90 and -180 <= lon <= 180):
            reason = "Invalid or missing coordinates"
        elif not (6 <= lat <= 38 and 68 <= lon <= 98):
            reason = "Outside India geographic envelope (6–38°N, 68–98°E)"
        elif row["country"] and row["country"].lower() not in {"india", "in", "ind"}:
            reason = "Non-Indian country value"
        elif not row["station_id"] or not row["station_name"]:
            reason = "Missing station ID or station name; no IDs/names invented"
        if reason:
            rejected.append({"row": index + 1, "station_id": row["station_id"], "reason": reason})
            continue
        if row["station_id"] in seen:
            duplicates.append(
                {
                    "row": index + 1,
                    "station_id": row["station_id"],
                    "reason": (
                        "Duplicate source row; first valid record retained"
                        if identity_origin == "derived record hash"
                        else "Duplicate ID; first valid record retained"
                    ),
                }
            )
            continue
        seen.add(row["station_id"])
        row.update(latitude=lat, longitude=lon)
        for field in ("num_chargers", "charging_power_kw", "tariff_inr_per_kwh"):
            value = numeric(row[field])
            if row[field] is not None and (
                value is None
                or value < 0
                or (field == "num_chargers" and not value.is_integer())
                or (field == "charging_power_kw" and value == 0)
            ):
                warnings.append(
                    {
                        "row": index + 1,
                        "field": field,
                        "reason": "Invalid numeric value set to null",
                    }
                )
                value = None
            row[field] = int(value) if value is not None and field == "num_chargers" else value
        observed = [
            "latitude",
            "longitude",
            "city",
            "state",
            "status",
            "connector_type",
            "num_chargers",
            "charging_power_kw",
        ]
        row["data_completeness_pct"] = round(
            100 * sum(row[f] is not None for f in observed) / len(observed), 1
        )
        row["source_row"] = index + 1
        row["station_id_origin"] = identity_origin
        stations.append(row)
    missing = {field: sum(row[field] is None for row in stations) for field in FIELDS}
    availability_values = {
        str(row["availability"]).lower() for row in stations if row["availability"] is not None
    }
    metadata = {
        "source_name": source_name,
        "source_url": source_url,
        "filename": filename,
        "imported_at": datetime.now(timezone.utc).isoformat(),
        "raw_sha256": hashlib.sha256(content).hexdigest(),
        "raw_records": len(raw),
        "valid_records": len(stations),
        "rejected_records": len(rejected),
        "duplicate_ids_removed": len(duplicates),
        "duplicate_source_rows_removed": sum(
            d["reason"].startswith("Duplicate source row") for d in duplicates
        ),
        "derived_id_records": sum(
            s["station_id_origin"] == "derived record hash" for s in stations
        ),
        "identity_policy": (
            "Missing source IDs use SHA-256 of the source row as an internal record key; "
            "not an observed station identifier. Identical source rows collapse; "
            "co-located distinct records remain separate."
            if generate_missing_ids
            else "Source station IDs required; none derived."
        ),
        "source_type_interpretation": "Raw source code, with no supplied definition; not a connector, charger count or power value.",
        "missing_fields": missing,
        "mapping": mapping,
        "columns": columns,
        "rejections": rejected,
        "duplicates": duplicates,
        "warnings": warnings,
        "capabilities": {
            field: any(row[field] is not None for row in stations) for field in FIELDS
        },
        "availability_index": bool(availability_values)
        and availability_values
        <= {"0", "1", "0.0", "1.0", "true", "false", "available", "unavailable"},
        "coordinate_validation": "Numeric range and India bounding envelope only; not a boundary polygon or ground verification.",
        "limitations": "Source observations are not live occupancy, reliability, demand or ground-verified locations.",
    }
    return {"stations": stations, "metadata": metadata, "preview": raw[:5]}
