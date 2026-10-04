"""Validate and activate the explicitly supplied station CSV; preserve previous snapshots."""

import argparse
import json
from pathlib import Path
from zipfile import ZipFile

from backend.ingestion import normalize
from backend.regions import regional_dataset
from backend.store import Store

ROOT = Path(__file__).resolve().parents[1]
MEMBER = "ev-charging-stations-india.csv"


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("archive", type=Path)
    parser.add_argument("--activate", action="store_true", help="Activate after validation")
    args = parser.parse_args()
    with ZipFile(args.archive) as archive:
        info = archive.getinfo(MEMBER)
        if info.file_size > 15 * 1024 * 1024:
            raise ValueError("Source member exceeds the 15 MB import limit.")
        content = archive.read(info)
    dataset = normalize(
        content,
        MEMBER,
        source_name="User-provided archive.zip / EV charging stations India",
        generate_missing_ids=True,
    )
    scoped = regional_dataset(dataset)
    if not scoped["stations"]:
        raise ValueError("No valid source records in the six requested states.")
    print(
        json.dumps(
            {
                "raw_records": dataset["metadata"]["raw_records"],
                "valid_records": dataset["metadata"]["valid_records"],
                "rejected_records": dataset["metadata"]["rejected_records"],
                "duplicates": dataset["metadata"]["duplicate_source_rows_removed"],
                "regional_records": scoped["metadata"]["regional_records"],
                "regional_counts": scoped["metadata"]["regional_counts"],
                "raw_sha256": dataset["metadata"]["raw_sha256"],
            },
            indent=2,
        )
    )
    if args.activate:
        (ROOT / "data/raw" / MEMBER).write_bytes(content)
        Store(ROOT / "data/local").save(dataset, content)
        target = ROOT / "docs/verification/user-dataset-import.json"
        target.write_text(json.dumps(regional_dataset(dataset)["metadata"], indent=2))
        print(f"Activated snapshot {dataset['metadata']['snapshot_id']}; audit: {target}")


if __name__ == "__main__":
    main()
