"""Adapt the audited six-state BEE files and optionally activate an immutable snapshot."""

import argparse
import csv
import hashlib
import io
import json
from pathlib import Path

from backend.ingestion import normalize
from backend.regions import regional_dataset
from backend.store import Store

ROOT = Path(__file__).resolve().parents[1]
PREPARED = ROOT / "data/processed/bee-six-states"
CONNECTOR_MAP = {
    "CCS-II": "CCS2",
    "Type-II AC": "Type2",
    "Type II": "Type2",
    "CHAdeMO": "CHAdeMO",
    "CHADEMO": "CHAdeMO",
    "CHAdeMo": "CHAdeMO",
    "Combo (CCS-II+CHAdeMO)": "CCS2;CHAdeMO",
    "Combo (CCS-II + CHAdeMo + Type II)": "CCS2;CHAdeMO;Type2",
    "Combo(CCS-II+Type-II)": "CCS2;Type2",
    "Combo ( Bharat AC-001 + Type-II AC)": "Bharat AC-001;Type2",
    "LEV AC Charge point": "LEV AC",
    "LEV AC Charge Point": "LEV AC",
    "LEV DC Charge Point (IS-17017-2-7)": "LEV DC",
    "LEV DC Charge Point (IS-17017-2-6)": "LEV DC",
    "LEV DC": "LEV DC",
}


def connector_types(source):
    """Map explicit connector names only; CCS/Bharat ambiguity stays unresolved."""
    values = []
    for label in source.split(" | "):
        values.extend(CONNECTOR_MAP.get(label, label).split(";"))
    return ";".join(dict.fromkeys(v for v in values if v)) or None


def prepare(directory=PREPARED):
    directory = Path(directory)
    for line in (directory / "checksums.sha256").read_text().splitlines():
        digest, filename = line.split("  ", 1)
        path = directory / filename
        if path.parent != directory or hashlib.sha256(path.read_bytes()).hexdigest() != digest:
            raise ValueError(f"Prepared source checksum mismatch: {filename}")
    audit = json.loads((directory / "audit.json").read_text())
    content = (directory / "station-locations.csv").read_bytes()
    rows = list(csv.DictReader(io.StringIO(content.decode("utf-8"))))
    charger_rows = list(csv.DictReader((directory / "charger-records-accepted.csv").open()))
    by_record = {r["source_record_id"]: r for r in charger_rows}
    if len(by_record) != audit["accepted_unique_charger_rows"]:
        raise ValueError("Accepted source charger rows do not reconcile with the audit.")
    dataset = normalize(
        content,
        "station-locations.csv",
        mapping={"connector_type": "connector_types_source"},
        source_name="Bureau of Energy Efficiency — six-state charging locations (26 Oct 2025)",
        source_url=audit["source_url"],
    )
    if len(dataset["stations"]) != len(rows) or len(rows) != audit["station_locations"]:
        raise ValueError("Location import did not accept every audited station group.")
    by_id = {r["station_id"]: r for r in rows}
    referenced = []
    for station in dataset["stations"]:
        source = by_id[station["station_id"]]
        ids = source["source_record_ids"].split(" | ")
        referenced.extend(ids)
        station.update(
            station_id_origin="derived location group",
            connector_type=connector_types(source["connector_types_source"]),
            source_connector_types=source["connector_types_source"],
            source_pdf_pages=source["source_pdf_pages"],
            reported_connector_count=int(source["reported_connector_count"])
            if source["reported_connector_count"]
            else None,
            source_charger_records=[
                {
                    field: by_record[rid][field]
                    for field in (
                        "source_record_id",
                        "connector_type_source",
                        "charger_rating_source",
                        "connector_rating_source",
                        "connector_count_source",
                        "pdf_page",
                    )
                }
                for rid in ids
            ],
        )
        # Connector counts are not device counts. Rating text has no explicit
        # unit in the PDF header, so it is not converted into station kW.
        assert station["num_chargers"] is None and station["charging_power_kw"] is None
    if len(referenced) != len(by_record) or set(referenced) != set(by_record):
        raise ValueError("Location groups do not partition all accepted charger rows.")
    dataset["metadata"].update(
        source_data_as_of=audit["source_data_as_of"],
        source_pdf_sha256=audit["pdf_sha256"],
        bee_preparation=audit,
        connector_mapping=CONNECTOR_MAP,
        derived_id_records=len(rows),
        identity_policy=audit["location_grouping"],
        limitations=(
            audit["limitations"] + " Source rating text is preserved without assuming kW units. "
            "Connector counts are kept separately from charger-device counts. "
            "Unspecified CCS and Bharat labels remain unresolved."
        ),
    )
    scoped = regional_dataset(dataset)
    expected = {s: c["station_locations"] for s, c in audit["by_state"].items()}
    if scoped["metadata"]["regional_counts"] != expected:
        raise ValueError("Application regional scope does not match prepared source counts.")
    return dataset, content


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--directory", type=Path, default=PREPARED)
    parser.add_argument("--activate", action="store_true")
    args = parser.parse_args()
    dataset, content = prepare(args.directory)
    store = Store(ROOT / "data/local")
    before = store.load()
    report = {
        "previous_snapshot_id": before["metadata"]["snapshot_id"] if before else None,
        "prepared_metadata": regional_dataset(dataset)["metadata"],
        "activated": args.activate,
    }
    if args.activate:
        store.save(dataset, content)
        # Keep the previous immutable snapshot and scenario links intact.
        report["snapshot_id"] = dataset["metadata"]["snapshot_id"]
        target = ROOT / "docs/verification/bee-dataset-import.json"
        target.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n")
    print(
        json.dumps(
            {
                "activated": args.activate,
                "snapshot_id": dataset["metadata"].get("snapshot_id"),
                "previous_snapshot_id": report["previous_snapshot_id"],
                "station_locations": len(dataset["stations"]),
                "regional_counts": report["prepared_metadata"]["regional_counts"],
            },
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
