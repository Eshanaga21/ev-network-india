# Browser verification screenshots

Screenshots 01–18 document the original academic interface and first E-Amrit extract. Screenshots 19–23 document the initial six-state redesign with that extract. Screenshots 25–31 below show the final user-provided CSV and its audited 282-record scope. Captured from the local application using actual validated source snapshots. Graph settings differ between views as indicated in each screenshot. Outputs describe observations, calculations or explicit model estimates.

## Empty-data onboarding

No station records or analysis shown before import.

![Empty-data onboarding](screenshots/01-onboarding.jpg)

## Reviewed source validation

160 raw records, 158 accepted and 2 rejected before import.

![Reviewed source validation](screenshots/02-validation.jpg)

## Loaded real-data map

Imported source coordinates and honest source/graph labels.

![Loaded real-data map](screenshots/03-loaded-map.jpg)

## Connected geographic route

Real Delhi–Noida station sequence under the disclosed model.

![Connected geographic route](screenshots/04-trip-route.jpg)

## Disconnected route

Delhi–Goa no-path result; no fallback edge.

![Disconnected route](screenshots/05-no-path.jpg)

## Network graph

Components, weighted proximity edges and structural highlights.

![Network graph](screenshots/06-graph-analysis.jpg)

## Modeled outage

Removal in a graph copy; 14 surviving stations lose reachability.

![Modeled outage](screenshots/07-resilience.jpg)

## Relative accessibility

Available-only weights, disabled missing data and source-relative ranking.

![Relative accessibility](screenshots/08-accessibility.jpg)

## Geographic candidates

Deterministic modeled locations derived from source geometry.

![Geographic candidates](screenshots/09-expansion.jpg)

## Actual graph addition

Before/after changes can show an isolated candidate, not fabricated improvement.

![Actual graph addition](screenshots/10-candidate-addition.jpg)

## Station comparison

Observed fields and calculated metrics for real selected source records.

![Station comparison](screenshots/11-comparison.jpg)

## Source-linked scenario

Saved immutable snapshot reference and settings.

![Source-linked scenario](screenshots/12-scenario.jpg)

## Tablet layout

1024×768, no page-level horizontal overflow.

![Tablet layout](screenshots/13-tablet.jpg)

## Mobile layout

390×844, map above scrollable controls and tables.

![Mobile layout](screenshots/14-mobile.jpg)

## Modeled charging timeline

Explicit low initial SOC and assumed charging power; no measured charger performance.

![Modeled charging timeline](screenshots/15-charging-timeline.jpg)

## Metric explanation

Input, interpretation and limitations; Tab remains in the dialog and Escape restores focus.

![Metric explanation](screenshots/16-explanation.jpg)

## Station inspector

Observed source fields, missing-value labels, completeness, metrics and real graph neighbors.

![Station inspector](screenshots/17-inspector.jpg)

## Source capability matrix

Missing connector, capacity, status, road-provider and geocoding features are explicitly disabled.

![Source capability matrix](screenshots/18-capabilities.jpg)


## Initial simplified finder (historical extract)

103 label-matching records before the archive replacement; the Rajasthan empty screen reflects that older source.

![Initial minimal finder](screenshots/19-minimal-finder.jpg)
![Original-source Rajasthan empty state](screenshots/20-regional-empty.jpg)
![Simple station details](screenshots/21-simple-station.jpg)
![Simple trip estimate](screenshots/22-simple-trip.jpg)
![Initial mobile layout](screenshots/23-minimal-mobile.jpg)

## Current finder: user-provided CSV

282 regional source records after exact-row deduplication, coordinate validation and flagged regional-coordinate conflicts. The interface keeps advanced tools behind Project tools.

![Current minimal finder](screenshots/25-current-finder.jpg)

## Current Rajasthan filter

42 records; a zero-source state is no longer implied by the older extract.

![Rajasthan filter](screenshots/26-current-rajasthan.jpg)

## Earlier geographic trip

Galleria → Heritage City, both actual CSV rows. 1.7 km geographic distance; 2.3 minutes at the entered speed assumption; 79.4% modeled arrival charge.

![Current trip](screenshots/27-current-trip.jpg)

## Earlier geographic no-path result

Galleria → Fairmont Jaipur has no path in the 25 km proximity model. This makes no claim about road feasibility.

![No connected path](screenshots/28-current-no-path.jpg)

## Current responsive layouts

![Mobile finder](screenshots/29-current-mobile.jpg)
![Tablet finder](screenshots/30-current-tablet.jpg)

## Current source disclosure

Counts, geographic conflicts, preserved source and internal identity policy.

![Source audit](screenshots/31-current-source-audit.jpg)

## Any-location address search

Photon returns actual public landmark coordinates; selecting a place does not create a station.

![Place search](screenshots/32-any-place-search.jpg)

## Door-to-door road trip

India Gate → Heritage City. OSRM returned 24.353 km and 27.343 minutes; the entered battery model estimates 72.207% arrival charge. The actual entered place is endpoint A; B is the selected destination. No home charging is assumed.

![Road trip from entered place](screenshots/33-door-to-door-road-trip.jpg)

## Map-selected endpoint

Typed starting coordinates and an actual map click select distinct endpoints, with trip calculation enabled.

![Map-selected point](screenshots/34-any-map-point.jpg)

## Mobile any-point controls

Both endpoints expose current-location and map-selection controls. Device permission was not requested during verification; callback success/errors were unit-tested.

![Mobile trip form](screenshots/35-mobile-any-point-form.jpg)
