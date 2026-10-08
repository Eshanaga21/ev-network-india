# Implementation review — 2026-10-04

EV Network Intelligence — India is implemented as the requested local React/TypeScript/Vite + FastAPI console. The original Streamlit prototype is preserved in `legacy/` and is not used at runtime. No Git commit, push, publication, deployment or pull request was performed. The initial extract was imported through the browser; the latest user-provided archive was validated and activated with the local reproducible import script; production never imports test fixtures or automatically loads the bundled extract.

## Current redesign: minimal regional finder

The default is now a consumer-facing station finder inspired by the supplied visual references: charcoal panels, mint accents, clear typography, search, six-state selection and readable station cards. Only Find stations / Plan a trip are visible. Two accessible searchable endpoint fields replace long selection forms; a selected EV or custom profile supplies battery capacity; current charge and reserve personalise the trip. Advanced controls, raw scores, graphs and reports remain available behind Project tools. Local Natural Earth state outlines and data-derived counted clusters improve map context without adding station records or a remote tile dependency.

The six-state scope is enforced server-side for all dataset responses and analyses. The active user-provided CSV exposes 282 records: UP 65, Delhi 102, Rajasthan 42, Haryana 49, Punjab 16 and MP 8. It contains 1,547 raw rows, 1,331 accepted source records, 14 invalid-coordinate rows and 202 repeated valid rows. Among 350 selected-state labels, 68 coordinates clearly conflict with the region and are flagged/excluded using cartographic polygons with a 5 km tolerance. Another 981 records have other/ambiguous state labels. No source GPS/state fields are repaired. Raw and previous snapshots remain unchanged.

The source has no publisher IDs; explicitly enabled SHA-256 source-row keys are internal identities, labeled as derived in metadata and station details. Original addresses are preserved/searchable, and raw numeric type codes have no inferred semantics. Source publisher URL/date are unknown. Current audit: `docs/verification/user-dataset-import.json`; snapshot `2ee144cf5153486e90e9cd0ba969a857`; SHA-256 `c6a8f921195877a474c47c7a524e117bc72e18f6ba4f39a4f73865bcd1092f20`.

Current totals: **107 backend tests and 31 frontend tests**. Checks cover state aliases, cartographic regional plausibility, conflicting labels, snapshot preservation, opt-in internal keys, exact duplicate handling, unmapped type semantics, address/name/city search, valid endpoints, Google adapter validation and navigation links preserving arbitrary endpoints/charging waypoints. Production build, lint and formatting pass. Historical screenshots and source audit below document the earlier extract; final dataset screenshots are labeled separately.

Google Maps integration added on 2026-10-07: finder basemap/advanced markers, optional server Places API (New) and Routes API, full provider-leg energy accounting, safe key separation and Google Maps navigation handoff. Google responses are transient, are displayed on Google's map and are not persisted/cached. Academic tools retain MapLibre/OSRM. Real Google map tiles, legal attribution, advanced station markers, counted clusters, place search and Routes are live-verified. The complete trip endpoint returned HTTP 200, Google road geometry and a feasible battery calculation for public inputs; snapshot/source hash stayed unchanged. The older key denied target APIs; the new supplied key works for all three. Local configuration currently uses one working key for both fields; separate restricted browser/server keys remain the deployment recommendation. Backend unit tests mock Google transport; live checks are recorded separately.

Any-location trips now support Photon place/address search, typed coordinates, map selection and explicitly requested browser current location at both ends. Live OSRM routes start/end at the entered points, with all road legs included in energy/time. Modeled charging occurs only at loaded stations, selected by a disclosed corridor heuristic and rechecked using provider waypoint legs. Public India Gate → Heritage City verification returned 24.353 km, 27.343 minutes and 72.207% modeled arrival SOC; source bytes/snapshot stayed unchanged. Evidence: `docs/verification/door-to-door-verification.json`.

The backend Gemini adapter and explicit Explain button are implemented with scalar trip facts only; addresses, precise coordinates and station names are excluded. A locally stored key read from the supplied screenshot returned HTTP 401. The user is replacing it locally; successful live authentication is pending. Credentials are in the ignored `.env`, never source or frontend. Configuration alone is not a verified connection. Browser device GPS permission was not requested by the agent; success, invalid coordinates/accuracy, permission denial, unsupported devices and timeout are unit-tested.

## Implemented scope

- Data onboarding: CSV/JSON chooser and drop target, header-only schema, raw preview, adjustable mapping, source attribution, rejected-row/duplicate/missing-field audit, review-before-commit, immutable normalized/raw snapshots, optional source refresh with honest failure state.
- Strict Pydantic graph/route/vehicle/index/clustering inputs, finite coordinate validation, India envelope, explicit-country checks, duplicate ID retention policy, optional-field nulls and capability detection.
- Local SQLite active-snapshot metadata and named scenarios; persistence, load/reactivation, duplication, deletion, reset and audited JSON export.
- Seven custom workspaces with 420px desktop sidebar, full-height dark MapLibre map, local Natural Earth geometry, local fonts, electric green/amber/red legends and observed/calculated/modeled labels.
- Geographic radius and undirected k-NN graphs, no forced connectivity, weighted edges, adjacency, degree/weighted degree, exact centralities, PageRank, density, components, bridges and articulation highlights.
- Station search and city/state filtering, manual coordinates, nearest real station snap, entered/resolved and snapped coordinates, snap-distance disclosure, Dijkstra/A*, measured runtime, sequence/edge exports, same-node/no-path results, speed assumptions.
- Sequential energy/SOC/charging model, reserve and stop constraints, charging timeline exports, transparent route-risk inputs/classification and explanation.
- Graph-copy outage simulation with before/after nodes, components, density, surviving-reference reachability, disconnected IDs, bridge/articulation impact and average within-component shortest path.
- Relative accessibility index with 100%-total weights, disabled missing components, normalized inputs, per-row available-weight coverage, classes, map/ranking and explanation.
- Deterministic MST spherical-midpoint candidates, bounded 40-gap pool, top 10 scoring/rationale, geographic gap explorer, actual graph rebuild for candidate addition, no demand/land/grid/traffic fabrication.
- Real-coordinate DBSCAN clustering and source-record density heatmap; field completeness independent of reliability; station inspector with source fields, graph metrics/neighbors and route/removal actions; 2–4 station comparison and resilience impact.
- Network health formula, metric/chart explanation dialogs, Viva mode, capability matrix, source audit/reproducibility panels, keyboard focus trap/Escape restoration, high-contrast and responsive layouts.
- Audited CSV/JSON downloads for requested data and results; safe CSV cells; printable escaped HTML academic report including dataset, filters, graph KPIs, centrality ranking, selected route/outage, index, candidates and limitations.
- OSRM and Photon provider adapters, explicit place search and any-point consumer road trip endpoint, complete provider-leg battery accounting, source-only modeled charging, honest geographic fallback and optional server-side Gemini explanations. Academic graph/route calculations retain geographic weights.

## Historical first dataset audit

| Property | Recorded value |
|---|---|
| Source | E-Amrit / NITI Aayog — documented extract 2026-09-10 |
| Source URL | https://e-amrit.niti.gov.in/getChargingStation |
| Raw file | `data/raw/eamrit_india_charging_stations.json` |
| Imported UTC | `2026-10-04T07:29:47.448160+00:00` |
| Snapshot | `57185fa1583f4b7e836e0999d1e22862` |
| Raw / valid / rejected / duplicate IDs | 160 / 158 / 2 / 0 |
| Raw SHA-256 | `52093ecc09ef20645bfbf9ad527820cbb880fa53bd490e874f88028cd15257af` |
| Rejections | Row 93 invalid coordinates; row 148 missing name |
| Missing in every accepted row | Country, operator, status, connector type, charger count, charging power |
| Source availability | Code `1` in all 158 rows; no live occupancy claim |
| Completeness | 50%: four of eight scored source fields present |

Provenance is inherited from the original project's documentation, preserved in `legacy/README.md`. The endpoint timed out during the current refresh attempt; an independently refreshed copy was not obtained. The unchanged documented public extract was uploaded and validated instead. Coordinates are schema/range/envelope-validated, not independently ground-verified. The source is sparse, not a national census. Repeated source names and distinct IDs at identical coordinates are retained.

## Automated verification

| Check | Result |
|---|---|
| Pytest | **60 passed** |
| Ruff lint | Passed for `backend/` and `scripts/` |
| Ruff format check | Passed |
| Frontend Vitest | **20 passed** |
| Frontend ESLint | Passed |
| Frontend Prettier check | Passed |
| TypeScript and Vite production build | Passed |
| npm dependency audit | 0 vulnerabilities |
| Actual loaded snapshot verification | Passed; saved JSON evidence and HTML report |

Backend tests cover mapping, aliases, invalid coordinates, missing values, duplicates, schema-only download, empty/no-dataset response, source-refresh failure without substitution, immutable snapshot/unload, no fixture dependency, exact radius/k-NN separation, zero-distance source nodes, Dijkstra/A*/same-node/no-path/snapping, battery energy conservation and infeasibility, capability-aware index/weights/row missingness, graph-copy removal and singleton removal, deterministic candidates/actual addition/empty cases, DBSCAN, health formula/empty score, scenario restoration/duplication/deletion, reports/hostile-source HTML escaping, versioned audit and OSRM response conversion.

Backend trip tests additionally cover arbitrary endpoints on disconnected graphs, full road-leg accounting, no home charging, real source waypoint routing, provider failures, place filtering and secret-free Gemini prompts/errors. Frontend location tests cover actual callback values and accuracy, denied/timeout/unavailable devices and invalid results. Frontend tests cover explicit empty endpoint defaults, no invented coordinates, validation, reproducible filters/graph settings, surfaced API errors, missing metric values, CSV quote/formula protection, JSON/CSV audit envelopes, download names/clicks, null preservation and object URL cleanup. These are focused logic tests; component behavior and layout were checked through the browser rather than claiming comprehensive automated UI coverage.

Two test-client deprecation warnings remain (Starlette/httpx and AnyIO). The build reports a large MapLibre/Recharts console chunk (shared MapLibre chunk ~1.05 MB minified / ~288 KB gzip; academic console ~426 KB / ~124 KB); the initial onboarding bundle is ~283 KB and the console is lazy loaded. The warning is not suppressed. The requirements lock pins validated top-level Python packages; transitive Python packages are not a fully resolved cross-platform lock.

## Browser and loaded-data evidence

Browser verification used the production bundle on port 4173 and the FastAPI backend on port 8001. It covered upload/validation/commit, real-map markers and source labels, connected and disconnected routing, low-SOC modeled charging, graph controls/components, outage, accessibility, DBSCAN, gap candidates, addition, station comparison, scenario save/reset/load, explanation dialogs and keyboard Escape/focus restoration. Screenshots for all eight requested acceptance states plus additional features are indexed in `docs/SCREENSHOTS.md`.

Read-only checks against the active source snapshot established:

- Original all-India acceptance before the requested regional restriction, at 25 km radius: 158 nodes, 5,312 edges, 11 components; largest component 101 stations; 2 isolates; 3 bridges.
- The two real source IDs `2` and `4` have a ~13.45 km geographic path; Dijkstra and A* return equal distance. With explicit initial SOC 10%, the model adds 40 kWh at the origin and estimates ~88.9 minutes at entered 30 kW and 90% efficiency. This is not measured station charging.
- Historical regional no-path verification used Delhi–Panchkula; the current CSV check uses Galleria (source row 2) and Fairmont Jaipur (source row 25).
- At 2 km radius, removing source ID `4` (EESL Tata Advance Systems Noida) in a copy reduces nodes 158→157, increases components 27→28, and leaves 14 surviving stations unreachable from the disclosed reference. The original snapshot and graph remain intact.
- Candidate generation is deterministic. Addition can create an isolated modeled node rather than improve connectivity; the actual before/after result is shown.
- Tablet 1024×768 and mobile 390×844 had document width equal to viewport width; map and sidebar/table layouts remained available. Temporary viewport overrides were reset.

`docs/verification/loaded-dataset-verification.json` records the source metadata, algorithm-version audits, all checked analysis results and saved scenario settings. `docs/verification/academic-report.html` is the independently generated printable report. Browser download-event completion was not observable in the in-app browser; downloads were invoked through UI controls, export generation and click/cleanup were unit-tested, and HTML output was verified separately. A saved scenario restored its settings and snapshot after reset; fresh browser reload preserved selected inputs and correctly required recalculation of transient results.

## Remaining limitations

1. No freshly re-downloaded E-Amrit extract, live occupancy, measured uptime, operational charging telemetry or externally verified station accuracy.
2. Source connector/ports/power/status/operator/country remain missing; dependent source analyses are disabled. Availability codes are observations in an old extract.
3. Geographic academic edges do not prove drivable or chargeable journeys. Consumer trip geometry is from OSRM; charging-stop selection is a corridor heuristic, not an optimum, and source compatibility/availability remain unverified.
4. Public Photon and OSRM demo services are configured and live-tested, with bounded cached requests, disclosed external data sharing and failure states. They have no production SLA; use hosted providers for larger usage. Gemini live authentication remains pending after HTTP 401.
5. Accessibility and health are relative academic heuristics. Candidate pair-gap halving is geometric, not measured area coverage; candidates lack land/water/grid/road/demand suitability screening and official boundary clipping.
6. Exact algorithms and a 2,000-record import cap suit local academic work. Large datasets, dense-map performance and multi-user workloads were not benchmarked.
7. Local-only app: no authentication/authorization, server deployment hardening, background worker queue, distributed storage or production monitoring. Bind it to loopback as documented.
8. Natural Earth boundaries are generalized cartographic context, not official Indian territorial boundaries. WebGL is required for the map; data/analysis tables are available separately.
9. Snapshot immutability is enforced by application creation behavior; files are not encrypted or tamper-proof. Keep source/snapshot backups. Local scenario settings are stored as JSON, not a version-migration system.
10. Large console chunk and two dependency deprecation warnings remain; automated frontend tests are logic-focused. Browser-native file-save completion was not independently observed.

## Changed files and preservation

See `docs/CHANGED_FILES.md` for the complete handoff manifest. New code is in `backend/`, `frontend/`, `scripts/`, and `docs/`; root `README.md`, `.gitignore` and `pyproject.toml` describe/run the new application. The old prototype was moved to `legacy/`. The supplied raw source file was preserved byte-for-byte. Runtime snapshot/database files, installed dependencies and build output are excluded from Git. All project changes remain uncommitted for review.


## Vehicle selection upgrade — 2026-10-07

The finder now offers a searchable EV selector, 14 source-backed brochure trim/battery editions, a custom-profile flow, locally saved multiple vehicles/default/removal and a compact chosen-vehicle card. Consumer trip APIs require a selected or custom EV and resolve catalogue capacity on the server. Range, connector matching, charging limits and known-tariff estimates are described in the [verification report](docs/verification/vehicle-selection-report.md). Missing charger data stays unknown; unverified stops make a charging plan conditional. The original station snapshot and Google Maps integration remain intact. Existing academic numerical experiments remain explicitly separate.

107 backend tests, 31 frontend tests, lint, formatting and production build pass. Desktop/mobile browser verification includes battery variants, default persistence, custom validation, connector filtering, result invalidation and real Google road recalculation. Screenshots 38–40 document this upgrade. No commit, push or deployment was performed for this upgrade.
