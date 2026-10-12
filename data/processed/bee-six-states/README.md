# BEE six-state dataset — prepared files

Prepared on 12 October 2026. Activated as the application dataset later the same day after user approval. The previous archive snapshot is preserved locally. See `docs/verification/bee-dataset-import.json` and `docs/verification/bee-loaded-dataset-verification.json` in the project root.

Source: [Bureau of Energy Efficiency public EV charging dataset](https://beeindia.gov.in/WriteReadData/RTF1984/EV_PCS_Data_29277.pdf), source snapshot dated 26 October 2025. This is a dated publication, not a live station feed. The original PDF is preserved locally at the path recorded in `audit.json`.

## Counts

| State | Raw charger rows | Excluded rows | Repeated rows removed | Accepted charger rows | Reported location groups |
|---|---:|---:|---:|---:|---:|
| Uttar Pradesh | 2,622 | 17 | 189 | 2,416 | 2,311 |
| Delhi | 3,475 | 0 | 1,341 | 2,134 | 1,974 |
| Rajasthan | 1,673 | 22 | 83 | 1,568 | 1,509 |
| Haryana | 2,877 | 15 | 1,805 | 1,057 | 921 |
| Punjab | 788 | 15 | 33 | 740 | 700 |
| Madhya Pradesh | 1,199 | 1 | 25 | 1,173 | 1,146 |
| **Total** | **12,634** | **70** | **3,476** | **9,088** | **8,561** |

All 1,159 PDF pages were parsed. There were no missing-table pages or unexpected-column rows. The national extraction contains 39,641 charger rows. Six-state selection uses canonical source state labels, including capitalization variants.

## What a location count means

A location group has the same source state, whitespace-normalized case-insensitive operator and location text, and identical numeric latitude and longitude. Separate operators or location labels at the same coordinates remain separate. Nearby sites are not merged. These are reproducible reported-location groups, not independently verified physical stations; the source does not supply stable station IDs.

Exact repeated source rows are removed after validation. Whitespace is normalized for comparisons; original connector labels, charger/connector ratings and reported connector counts are retained. Separate rows at one grouped location remain available in the accepted charger file. The summed reported connector count is supplied only when all component counts are positive integers; it is not a verified inventory of charger devices.

The 70 excluded source rows remain in a separate file: 60 have missing/invalid coordinates or lie outside the broad India envelope; 10 lie outside the six-state cartographic region plus a 5 km border tolerance. The geometry is generalized Natural Earth data, not an official boundary. Coordinates are checked against the union of the six states; per-state CSV membership follows the original state label and does not prove individual-state boundary correctness. Coordinates are never repaired.

## Connector and operational limitations

The dataset covers cars and light electric vehicles/two-wheelers. 4,189 of the reported location groups list only LEV connector labels. The total of 8,561 must not be presented as 8,561 car-compatible stations. Connector compatibility needs explicit mapping against each vehicle; an unspecified "CCS" label must not automatically become "CCS2".

There are no verified live availability, tariff or operational-status fields. Missing specifications are not filled or estimated. Charger ratings remain source text with no invented units or charging performance. Manufacturer/charger compatibility and charging-cost estimates need additional evidence.

Accepted charger-record counts by original connector label:

| Source connector label | Accepted rows |
|---|---:|
| Bharat AC | 688 |
| Bharat AC-001 | 640 |
| Bharat DC-001 | 334 |
| CCS | 1,257 |
| CCS-II | 629 |
| CHADEMO | 2 |
| CHAdeMO | 22 |
| Combo ( Bharat AC-001 + Type-II AC) | 5 |
| Combo (CCS-II + CHAdeMo + Type II) | 48 |
| Combo (CCS-II+CHAdeMO) | 73 |
| Combo(CCS-II+Type-II) | 6 |
| LEV AC Charge point | 4,065 |
| LEV DC | 19 |
| LEV DC Charge Point (IS-17017-2-6) | 6 |
| LEV DC Charge Point (IS-17017-2-7) | 143 |
| Type II | 110 |
| Type-II AC | 1,041 |

## Files

- `station-locations.csv`: combined reported-location groups for the six states.
- `uttar-pradesh.csv`, `delhi.csv`, `rajasthan.csv`, `haryana.csv`, `punjab.csv`, `madhya-pradesh.csv`: individual state location groups.
- `charger-records-raw.csv`: every selected source row with PDF page/table/row references.
- `charger-records-accepted.csv`: validated source rows after exact repeat removal.
- `charger-records-duplicates.csv`: repeated rows retained for audit.
- `charger-records-excluded.csv`: quarantined rows with the exclusion reason.
- `audit.json`: source URL, immutable PDF SHA-256, state counts, national source labels and cleaning rules.
- `verification.json`: reconciliation checks and independent PDF text spot checks for all six states.
- `checksums.sha256`: checksums of the prepared files, excluding itself.

The location file retains original connector descriptions. `scripts/import_bee_dataset.py` adapts explicit connector types, validates checksums and location/charger partitions, and activates an immutable application snapshot when passed `--activate`. Raw ambiguous labels and missing tariffs/power/availability are preserved. Imports support 15,000 records, while exact academic graphs are limited to 2,000 filtered stations; provider road trips use the full dataset without a proximity graph. The prepared files remain separate from the local active snapshot. No Git push or deployment was performed.

## Reproduce

Install `pdfplumber` in a Python environment, then run from the project root:

```sh
python -m scripts.segregate_bee_dataset /path/to/EV_PCS_Data_29277.pdf
```

The extractor preserves the source PDF under the ignored `data/local/dataset-research/` directory and writes the prepared CSVs and audit to this directory. `verification.json` records the additional checks performed for this delivery; it is not generated by extraction.

Verification reconciles all partitions, unique IDs, group membership and individual state exports. Independent `pypdf` text extraction matched operator, location, GPS and connector values on a sample source row in each state. These checks verify extraction and preparation, not on-site availability.
