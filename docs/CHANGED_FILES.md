# Local handoff file manifest

No commits, staging, pushes, deployment or pull request creation were performed. The starting project files were untracked. This manifest describes the working tree rather than implying a committed diff.

## New application

- `backend/`: validation, persistence, graph algorithms, provider interface, FastAPI endpoints, requirements and 60 tests.
- `frontend/`: minimal station finder, optional academic console/onboarding, MapLibre assets and worker, charts, state, audited exports, 20 logic tests and locked npm dependencies.
- `scripts/verify_loaded_dataset.py`: acceptance checks against the actual imported snapshot.
- `docs/`: screenshots, evidence, printable report and this manifest.
- Root `.gitignore`, `pyproject.toml`, `README.md`, `IMPLEMENTATION_REVIEW.md`: local setup, checks, algorithms and limitations.

## Preserved original material

The old root `app.py`, `pages/`, `src/`, `tests/`, and `requirements.txt` were moved to `legacy/`; the original README was copied to `legacy/README.md`. The supplied `data/raw/eamrit_india_charging_stations.json` was unchanged. Older data artifacts remain preserved. They are not automatically imported by the new application.

## Runtime files excluded from Git

`data/local/metadata.sqlite3`, immutable snapshot folders, `frontend/node_modules/`, `frontend/dist/`, Python/tool caches and local environment files. The active reviewed snapshot and saved scenario are available on this machine.

## Current redesign and dataset changes

- `backend/regions.py`, `geography.py`: six-state enforcement, preserved source states and flagged coordinate conflicts.
- `backend/ingestion.py`, `main.py`: opt-in deterministic internal record identities, address/raw-type preservation and audited import/scope metadata.
- `backend/tests/test_regions.py`, `test_geography.py`, `test_record_identity.py`: meaningful source integrity and scope checks.
- `frontend/src/StationFinder.tsx`, `finder.css`, `finder.ts`, `finder.test.ts`: minimal responsive finder, address search, accessible trip suggestions and simple result states.
- `frontend/src/App.tsx`, `Console.tsx`, `MapView.tsx`, `Onboarding.tsx`: default finder, optional advanced workspace, correctly placed counted markers and reviewed derived-ID import option.
- `frontend/public/regions.geojson`, `regionGeometry.ts`, `BASEMAP_NOTICE.md`: local geographic context and attribution.
- `data/raw/ev-charging-stations-india.csv`: exact extracted source bytes from user-supplied archive.
- `scripts/import_user_archive.py`, `verify_loaded_dataset.py`: reproducible reviewed import and real-source acceptance checks.
- README, review, redesign note, gallery and verification artifacts now describe the current CSV separately from historical evidence.

## Any-location trip changes

- `backend/providers.py`, `trips.py`, `gemini.py`, `main.py`, `models.py`: Photon place search, OSRM door-to-door routes, source-only modeled charging and optional private server-side Gemini explanations.
- `backend/engine.py`: entered-point geographic connector distances now participate in battery/time totals; arbitrary starts cannot charge.
- `backend/tests/test_door_to_door.py`, `conftest.py`: road-leg, source waypoint, failure and AI prompt privacy tests; automated tests disable external API calls and real credentials.
- `frontend/src/EndpointChoice.tsx`, `tripPoints.ts`, `currentLocation.ts` and tests: any-location endpoints, bounded explicit GPS request, preserved accuracy, keyboard/manual fallback and stale-request cancellation.
- `frontend/src/StationFinder.tsx`, `MapView.tsx`, `finder.css`: any-point form, A/B pins, map selection and simple road results.
- `.env.example`, Python requirements: provider and Gemini placeholders; dotenv loads private backend configuration. Real `.env` is ignored and excluded from this manifest.
- Verification, review, setup and screenshots describe public provider acceptance and pending Gemini authentication.

## Workspace files (excluding private environment/runtime/build/dependency caches)

- `.env.example`
- `.gitignore`
- `IMPLEMENTATION_REVIEW.md`
- `README.md`
- `backend/__init__.py`
- `backend/engine.py`
- `backend/gemini.py`
- `backend/geography.py`
- `backend/ingestion.py`
- `backend/main.py`
- `backend/models.py`
- `backend/providers.py`
- `backend/regions.py`
- `backend/requirements.lock.txt`
- `backend/requirements.txt`
- `backend/store.py`
- `backend/tests/conftest.py`
- `backend/tests/test_api.py`
- `backend/tests/test_door_to_door.py`
- `backend/tests/test_engine.py`
- `backend/tests/test_geography.py`
- `backend/tests/test_integrity.py`
- `backend/tests/test_record_identity.py`
- `backend/tests/test_regions.py`
- `backend/trips.py`
- `data/raw/eamrit_india_charging_stations.json`
- `data/raw/ev-charging-stations-india.csv`
- `docs/CHANGED_FILES.md`
- `docs/REDESIGN.md`
- `docs/SCREENSHOTS.md`
- `docs/screenshots/01-onboarding.jpg`
- `docs/screenshots/02-validation.jpg`
- `docs/screenshots/03-loaded-map.jpg`
- `docs/screenshots/04-trip-route.jpg`
- `docs/screenshots/05-no-path.jpg`
- `docs/screenshots/06-graph-analysis.jpg`
- `docs/screenshots/07-resilience.jpg`
- `docs/screenshots/08-accessibility.jpg`
- `docs/screenshots/09-expansion.jpg`
- `docs/screenshots/10-candidate-addition.jpg`
- `docs/screenshots/11-comparison.jpg`
- `docs/screenshots/12-scenario.jpg`
- `docs/screenshots/13-tablet.jpg`
- `docs/screenshots/14-mobile.jpg`
- `docs/screenshots/15-charging-timeline.jpg`
- `docs/screenshots/16-explanation.jpg`
- `docs/screenshots/17-inspector.jpg`
- `docs/screenshots/18-capabilities.jpg`
- `docs/screenshots/19-minimal-finder.jpg`
- `docs/screenshots/20-regional-empty.jpg`
- `docs/screenshots/21-simple-station.jpg`
- `docs/screenshots/22-simple-trip.jpg`
- `docs/screenshots/23-minimal-mobile.jpg`
- `docs/screenshots/25-current-finder.jpg`
- `docs/screenshots/26-current-rajasthan.jpg`
- `docs/screenshots/27-current-trip.jpg`
- `docs/screenshots/28-current-no-path.jpg`
- `docs/screenshots/29-current-mobile.jpg`
- `docs/screenshots/30-current-tablet.jpg`
- `docs/screenshots/31-current-source-audit.jpg`
- `docs/screenshots/32-any-place-search.jpg`
- `docs/screenshots/33-door-to-door-road-trip.jpg`
- `docs/screenshots/34-any-map-point.jpg`
- `docs/screenshots/35-mobile-any-point-form.jpg`
- `docs/verification/academic-report.html`
- `docs/verification/checks-summary.json`
- `docs/verification/door-to-door-verification.json`
- `docs/verification/loaded-dataset-verification.json`
- `docs/verification/npm-audit.json`
- `docs/verification/user-dataset-import.json`
- `frontend/eslint.config.js`
- `frontend/index.html`
- `frontend/package-lock.json`
- `frontend/package.json`
- `frontend/public/BASEMAP_NOTICE.md`
- `frontend/public/regions.geojson`
- `frontend/public/world.geojson`
- `frontend/src/App.tsx`
- `frontend/src/Console.tsx`
- `frontend/src/EndpointChoice.tsx`
- `frontend/src/MapView.tsx`
- `frontend/src/Onboarding.tsx`
- `frontend/src/StationFinder.tsx`
- `frontend/src/api.test.ts`
- `frontend/src/api.ts`
- `frontend/src/currentLocation.test.ts`
- `frontend/src/currentLocation.ts`
- `frontend/src/finder.css`
- `frontend/src/finder.test.ts`
- `frontend/src/finder.ts`
- `frontend/src/main.tsx`
- `frontend/src/regionGeometry.ts`
- `frontend/src/shared.tsx`
- `frontend/src/store.ts`
- `frontend/src/style.css`
- `frontend/src/tripPoints.test.ts`
- `frontend/src/tripPoints.ts`
- `frontend/src/types.ts`
- `frontend/src/vite-env.d.ts`
- `frontend/tsconfig.json`
- `frontend/vite.config.ts`
- `legacy/README.md`
- `legacy/app.py`
- `legacy/pages/1_Overview.py`
- `legacy/pages/2_Network_Analysis.py`
- `legacy/pages/3_Route_Optimization.py`
- `legacy/pages/4_Accessibility.py`
- `legacy/pages/5_Recommendations.py`
- `legacy/pages/6_Resilience.py`
- `legacy/pages/7_Methodology.py`
- `legacy/requirements.txt`
- `legacy/src/__init__.py`
- `legacy/src/accessibility.py`
- `legacy/src/data_cleaning.py`
- `legacy/src/data_loader.py`
- `legacy/src/graph_analysis.py`
- `legacy/src/graph_builder.py`
- `legacy/src/resilience.py`
- `legacy/src/route_optimizer.py`
- `legacy/src/session.py`
- `legacy/src/station_recommendation.py`
- `legacy/src/ui.py`
- `legacy/src/utils.py`
- `legacy/src/visualization.py`
- `legacy/tests/conftest.py`
- `legacy/tests/test_data.py`
- `legacy/tests/test_graph.py`
- `legacy/tests/test_recommendations.py`
- `legacy/tests/test_resilience.py`
- `legacy/tests/test_routes.py`
- `pyproject.toml`
- `scripts/import_user_archive.py`
- `scripts/verify_loaded_dataset.py`
