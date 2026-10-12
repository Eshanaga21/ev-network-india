"""Extract the public BEE PDF into audited six-state charger rows and station locations.

Run with pdfplumber installed. This prepares data; it does not replace the active snapshot.
Source row and page references are retained. Missing values and original coordinates
are never repaired. Location grouping is a reproducible identity proxy, not a claim
that nearby addresses refer to separate ground-verified facilities.
"""

import argparse
import csv
import hashlib
import json
import math
import re
import shutil
from collections import Counter, defaultdict
from pathlib import Path

import pdfplumber

from backend.geography import in_requested_region
from backend.regions import REGIONS, canonical_state

ROOT = Path(__file__).resolve().parents[1]
SOURCE_URL = "https://beeindia.gov.in/WriteReadData/RTF1984/EV_PCS_Data_29277.pdf"
FIELDS = [
    "operator",
    "sector",
    "state",
    "district",
    "city",
    "location",
    "latitude",
    "longitude",
    "connector_type_source",
    "charger_rating_source",
    "connector_rating_source",
    "connector_count_source",
]


def clean(value):
    return re.sub(r"\s+", " ", str(value or "")).strip()


def number(value):
    try:
        n = float(value)
        return n if math.isfinite(n) else None
    except (ValueError, TypeError):
        return None


def identity(values):
    return hashlib.sha256(
        json.dumps(values, ensure_ascii=False, separators=(",", ":")).encode()
    ).hexdigest()


def write_csv(path, rows, fields):
    with path.open("w", newline="", encoding="utf-8") as output:
        writer = csv.DictWriter(output, fieldnames=fields, extrasaction="ignore")
        writer.writeheader()
        writer.writerows(rows)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("pdf", type=Path)
    parser.add_argument("--output", type=Path, default=ROOT / "data/processed/bee-six-states")
    args = parser.parse_args()
    args.output.mkdir(parents=True, exist_ok=True)
    pdf_hash = hashlib.sha256(args.pdf.read_bytes()).hexdigest()
    original = ROOT / "data/local/dataset-research" / f"bee-{pdf_hash[:12]}.pdf"
    original.parent.mkdir(parents=True, exist_ok=True)
    if not original.exists():
        shutil.copyfile(args.pdf, original)
    rows, issues, pages_without_tables = [], [], []
    national_counts, national_connectors = Counter(), Counter()
    national_rows = 0
    with pdfplumber.open(args.pdf) as pdf:
        page_count = len(pdf.pages)
        for page_number, page in enumerate(pdf.pages, 1):
            tables = page.extract_tables()
            if not tables:
                pages_without_tables.append(page_number)
            for table_number, table in enumerate(tables, 1):
                for row_number, raw in enumerate(table, 1):
                    values = [clean(v) for v in raw]
                    if not any(values) or values[:3] == ["CPO Name", "Govt/Private", "State"]:
                        continue
                    refs = {
                        "pdf_page": page_number,
                        "pdf_table": table_number,
                        "pdf_table_row": row_number,
                    }
                    if len(values) != len(FIELDS):
                        issues.append(
                            {**refs, "reason": "Unexpected column count", "values": values}
                        )
                        continue
                    row = dict(zip(FIELDS, values))
                    national_rows += 1
                    national_counts[row["state"]] += 1
                    national_connectors[row["connector_type_source"]] += 1
                    state = canonical_state(row["state"])
                    if state is None:
                        continue
                    row.update(refs)
                    row["source_state"] = row["state"]
                    row["state"] = state
                    row["source_record_id"] = "bee-row:" + identity(values)
                    rows.append(row)
            page.close()
            if page_number % 100 == 0:
                print(
                    f"Extracted {page_number}/{page_count} pages; {len(rows)} six-state charger rows",
                    flush=True,
                )

    seen, accepted, excluded, duplicates = set(), [], [], []
    for row in rows:
        lat, lon = number(row["latitude"]), number(row["longitude"])
        reason = None
        if lat is None or lon is None or not (6 <= lat <= 38 and 68 <= lon <= 98):
            reason = "Invalid or missing coordinates, or outside India envelope"
        elif not row["location"] or not row["operator"]:
            reason = "Missing operator or location identity"
        elif not in_requested_region(lat, lon):
            reason = "Coordinates outside the six-state cartographic region and 5 km tolerance"
        if reason:
            excluded.append({**row, "reason": reason})
            continue
        if row["source_record_id"] in seen:
            duplicates.append(row)
            continue
        seen.add(row["source_record_id"])
        accepted.append(row)

    groups = defaultdict(list)
    for row in accepted:
        key = (
            row["state"],
            row["operator"].casefold(),
            row["location"].casefold(),
            number(row["latitude"]),
            number(row["longitude"]),
        )
        groups[key].append(row)
    stations = []
    for key, members in groups.items():
        first = members[0]
        connectors = sorted(
            {r["connector_type_source"] for r in members if r["connector_type_source"]}
        )
        counts = [number(r["connector_count_source"]) for r in members]
        stations.append(
            {
                "station_id": "bee-location:" + identity(key),
                "station_name": first["location"],
                "operator": first["operator"],
                "state": first["state"],
                "city": first["city"],
                "district": first["district"],
                "latitude": key[3],
                "longitude": key[4],
                "address": first["location"],
                "connector_types_source": " | ".join(connectors),
                "reported_connector_count": sum(int(c) for c in counts)
                if all(c is not None and c > 0 and c.is_integer() for c in counts)
                else "",
                "charger_record_count": len(members),
                "source_pdf_pages": " | ".join(
                    str(n) for n in sorted({r["pdf_page"] for r in members})
                ),
                "source_record_ids": " | ".join(r["source_record_id"] for r in members),
            }
        )
    stations.sort(
        key=lambda s: (REGIONS.index(s["state"]), s["operator"], s["station_name"], s["station_id"])
    )
    counts = {
        state: {
            "raw_charger_rows": sum(r["state"] == state for r in rows),
            "excluded_charger_rows": sum(r["state"] == state for r in excluded),
            "duplicate_charger_rows": sum(r["state"] == state for r in duplicates),
            "accepted_unique_charger_rows": sum(r["state"] == state for r in accepted),
            "station_locations": sum(s["state"] == state for s in stations),
        }
        for state in REGIONS
    }
    row_fields = FIELDS + [
        "source_state",
        "source_record_id",
        "pdf_page",
        "pdf_table",
        "pdf_table_row",
    ]
    write_csv(args.output / "charger-records-raw.csv", rows, row_fields)
    write_csv(args.output / "charger-records-accepted.csv", accepted, row_fields)
    write_csv(args.output / "charger-records-excluded.csv", excluded, row_fields + ["reason"])
    write_csv(args.output / "charger-records-duplicates.csv", duplicates, row_fields)
    write_csv(
        args.output / "station-locations.csv",
        stations,
        list(stations[0]) if stations else ["station_id"],
    )
    for state in REGIONS:
        write_csv(
            args.output / (state.lower().replace(" ", "-") + ".csv"),
            [s for s in stations if s["state"] == state],
            list(stations[0]) if stations else ["station_id"],
        )
    report = {
        "source_url": SOURCE_URL,
        "source_data_as_of": "2025-10-26",
        "pdf_sha256": pdf_hash,
        "source_pdf_copy": str(original),
        "source_pdf_pages": page_count,
        "national_charger_rows_extracted": national_rows,
        "national_raw_state_counts": dict(national_counts),
        "national_connector_labels": dict(national_connectors),
        "six_state_raw_charger_rows": len(rows),
        "excluded_charger_rows": len(excluded),
        "duplicate_charger_rows": len(duplicates),
        "accepted_unique_charger_rows": len(accepted),
        "station_locations": len(stations),
        "by_state": counts,
        "extraction_issues": issues,
        "pages_without_tables": pages_without_tables,
        "location_grouping": "Same canonical source state, whitespace-normalized case-insensitive operator and location text, and identical numeric latitude/longitude. Distinct labels at the same GPS and different operators remain separate; no proximity merging or ground verification.",
        "coordinate_check": "India envelope and six-state Natural Earth polygon union plus 5 km tolerance. Source state labels retained; does not establish individual-state boundary correctness.",
        "limitations": "Station-location IDs are derived, not official station IDs. Rows may describe chargers rather than sites. Exact repeated rows removed; connector totals may still be ambiguous. Mixed two-wheeler/car connectors retained as source labels; compatibility requires explicit mapping. No tariffs, live availability or operational guarantees inferred.",
    }
    (args.output / "audit.json").write_text(json.dumps(report, ensure_ascii=False, indent=2))
    print(
        json.dumps(
            {
                k: report[k]
                for k in [
                    "national_charger_rows_extracted",
                    "six_state_raw_charger_rows",
                    "excluded_charger_rows",
                    "duplicate_charger_rows",
                    "accepted_unique_charger_rows",
                    "station_locations",
                    "by_state",
                    "extraction_issues",
                    "pages_without_tables",
                ]
            },
            indent=2,
        ),
        flush=True,
    )


if __name__ == "__main__":
    main()
