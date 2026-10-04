# Minimal regional station finder

The default interface has been redesigned around everyday searching: a charcoal and mint map, two tabs (Find stations / Plan a trip), one city/station search, a six-state selector and readable source-record cards. Selecting a card or pin opens a compact station panel with Start here / Go here. The trip form uses two accessible searchable fields, battery size and current charge. Detailed model settings are collapsed; route results show only distance, assumed travel time and modeled arrival charge. There is no dashboard of graph scores on the main screen. Academic workspaces remain behind Project tools.

## Requested region

| State | Records in the current extract |
|---|---:|
| Uttar Pradesh | 65 |
| Delhi | 102 |
| Rajasthan | 42 |
| Haryana | 49 |
| Punjab | 16 |
| Madhya Pradesh | 8 |
| Total | **282** |

The server enforces the scope for dataset responses, graphs, routing, analysis and reports. The current user-supplied archive contains 1,547 raw rows, 14 invalid-coordinate rows and 202 repeated valid rows, leaving 1,331 source records. Of 350 selected-state labels, 68 have coordinates clearly outside the requested regional map and are flagged/excluded. Another 981 records have other/ambiguous state labels. The guard uses local cartographic polygons plus a disclosed 5 km border tolerance, not official boundary validation. Source GPS/state fields are never repaired or inferred. Source and previous snapshots are preserved.

The source has no publisher station IDs. Opt-in deterministic internal keys are derived from source-row SHA-256; duplicates are transparent and co-located distinct rows remain distinct. Addresses are preserved/searchable; numeric type codes remain uninterpreted. No availability, power or road directions are invented.

Local Natural Earth state polygons provide geographic context; they are cartographic, not official boundaries. Grouped map-pin counts come from the visible station data. User-entered battery/charging inputs remain explicit model assumptions. Source information is available through Our data without cluttering the search view.

## Changed implementation

- `frontend/src/StationFinder.tsx`: default finder, station cards, simple details, accessible endpoint suggestions, battery fields, compact route/no-path results and tool entry points.
- `frontend/src/finder.css`, `finder.ts`, `finder.test.ts`: responsive styling, filtering/endpoint helpers and focused tests.
- `frontend/src/App.tsx`: opens the finder by default and lazily loads the optional academic console.
- `frontend/src/Console.tsx`: return-to-finder action and regional record count.
- `frontend/src/MapView.tsx`: simple presentation, actual-data clusters and labels, regional outlines and fit bounds; academic graph presentation preserved.
- `frontend/public/regions.geojson`, `frontend/src/regionGeometry.ts`: six local Natural Earth polygons and derived viewport bounds.
- `backend/regions.py`, `backend/main.py`: centralized scope enforcement, aliases, regional capability/count metadata and audit scope.
- `backend/tests/test_regions.py`: aliases, out-of-scope records/endpoints, zero-source states, capability detection and snapshot preservation.
- Documentation and loaded-dataset verification now distinguish source totals from the displayed regional subset.

No commits or remote publishing were performed.

## Current validation

60 backend and 20 frontend tests pass. Ruff, ESLint, Prettier and the TypeScript/Vite production build pass. The source-specific verification compares Dijkstra/A*, checks a true disconnected trip, runs the academic modules and report, verifies deterministic candidates and confirms source snapshot immutability. The mapping chunk-size and two Python test-client deprecation warnings remain disclosed. Gemini explanations are implemented server-side; live authentication is pending after HTTP 401.

## Any start or destination

Starting point and destination accept Photon address/place results, typed coordinates, actual map clicks, device current location or loaded station records. Only explicit search/location actions invoke those services. OSRM provides complete door-to-door road geometry and distances for battery accounting. Charging remains a disclosed source-station model with user assumptions, never invented at a home. Offline/provider failure returns a labeled geographic estimate including connector distances, which may have no path. Public landmark API acceptance is in `verification/door-to-door-verification.json`; screenshots 32–35 show the new flow. Gemini receives only scalar trip facts when requested; the supplied local key is awaiting correction after HTTP 401.
