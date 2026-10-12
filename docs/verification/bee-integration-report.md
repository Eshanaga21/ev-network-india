# BEE dataset activation verification

Verified on 12 October 2026. The active local snapshot now contains all 8,561 audited six-state location groups; the previous 282-record archive snapshot remains recoverable.

State counts: Uttar Pradesh 2,311; Delhi 1,974; Rajasthan 1,509; Haryana 921; Punjab 700; Madhya Pradesh 1,146. All counts match the prepared source exports. The immutable source CSV and original BEE PDF SHA-256 hashes reconcile.

Explicit connector descriptions are mapped while original labels and PDF page references remain attached to each location. Unspecified CCS and Bharat types remain unresolved. A complete CCS2/Type2 car profile finds 1,736 confirmed matching locations, 4,189 incompatible light-EV-only locations and 2,636 unknown locations. The source snapshot is dated 26 October 2025; it does not provide live availability or verified tariffs. Rating text has no explicit unit in the PDF header, so charging kW are not inferred. Connector counts remain distinct from charger-device counts.

Full-dataset station browsing and provider road planning work without allocating an all-pairs distance matrix. Imports accept up to 15,000 records. Exact academic graph calculations and geographic fallback remain limited to 2,000 filtered stations; oversized requests return an actionable filter message before allocating. Actual-source city analysis passed. A local deterministic route provider verified door-to-door planning against the active snapshot; no new billable directions requests were made.

Validation: 114 backend tests and 36 frontend tests passed. Python lint/format, frontend lint/format and production build passed. Existing test-client deprecation warnings and the mapping chunk-size warning remain.

Desktop (1280×720): full and state counts, BEE attribution, Google Maps marker clusters, confirmed connector filtering and station source details verified. Delhi showed 1,974 locations; the existing selected CCS2 vehicle filter showed 174 confirmed Delhi matches. Station details retained the original combo connector description and BEE PDF page 119.

Mobile (390×844): Punjab showed 700 locations; map, selector and station browsing remained usable. Document content width equaled the 390px viewport, with no horizontal overflow. Temporary viewport override and test filters were restored.

Evidence: `bee-dataset-import.json`, `bee-loaded-dataset-verification.json`, `../screenshots/bee-source-counts-desktop.jpg`, and `../screenshots/bee-finder-mobile.jpg`.

Reproduce from the project root:

```sh
python3 -m scripts.import_bee_dataset --activate
python3 -m scripts.verify_loaded_dataset
```

The importer checks every prepared-file checksum before creating a new immutable snapshot. No push or deployment was performed.
