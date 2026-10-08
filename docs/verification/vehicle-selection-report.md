# Vehicle selection and personalised planning — verification report

Verified locally on 7 October 2026. No push, deployment, Git commit or publication was performed for this upgrade. The existing Google Maps work and the six-state source snapshot were preserved.

## Delivered flow

Station browsing remains available without a vehicle. The consumer **Plan a trip** flow begins with **Select your EV**. A searchable manufacturer → model → variant selector leads to a vehicle confirmation card, current battery percentage, arrival reserve and adjustable consumption. Catalogue records separate battery and trim variants. A custom profile accepts named capacity, connector types and optional AC/DC input limits; blank limits remain unknown. Input errors are explained before saving.

The compact chosen-vehicle card appears in station search and trip planning. **Change vehicle** opens a local garage supporting multiple vehicles, default selection and removal. The default is restored on reload. Preferences are saved with each vehicle in the browser; addresses are not saved in this garage. Invalid stored records are discarded, unavailable catalogue editions cannot be used, and storage failures show a session-only warning.

Personalised consumer trip endpoints require an `ev_profile` on the server. The server resolves catalogue capacity itself, so an arbitrary submitted capacity cannot override a manufacturer record. Existing academic geographic experiments retain their explicitly entered numerical model and remain separate from the consumer journey planner.

## Specifications and attribution

Fourteen trim/battery records use these verified brochure editions, rather than a claim that they represent every current vehicle on sale:

| Manufacturer/model | Battery editions | Published certified ranges | Source |
|---|---|---|---|
| Tata Tiago.ev | 19.2 / 24 kWh; XE MR, XT MR, XT LR, XZ+ Tech Lux LR | 223 / 293 km; MIDC Parts 1 + 2, ARAI | [Tata 2025 brochure, manufacturer-hosted regional mirror, pp. 24–25](https://cars.tatamotors.lk/images/Tiago-ev-brochure-2025-dom.pdf) |
| Hyundai CRETA Electric | 42 / 51.4 kWh; four standard-battery and two long-range trims | 390 / 473 km; MIDC Parts 1 + 2, ARAI | [Hyundai launch brochure, technical specifications](https://www.hyundai.com/content/dam/hyundai/in/en/data/brochure/cretaelctricbrochure.pdf) |
| MG Windsor EV | 38 / 52.9 kWh; Excite, Exclusive, Essence, Essence Pro | 332 / 449 km; MIDC Parts 1 + 2, certifying authority | [MG May 2025 brochure, official dealer host, p. 40](https://dealers.mgmotor.co.in/files/banner_images/349472/2151_1746535393_NewWindsorEVPROBrochure.pdf) |

All record sources explicitly list CCS2. Unverified additional vehicle connectors are not inferred. MG specifies DC limits of 45/60 kW. Hyundai’s quoted 50 kW test charger and Tata’s charging-time references do not establish vehicle maximum DC limits; those remain null. Wallbox ratings are not treated as onboard AC limits.

The year/edition and source link are visible beside certified range. Newer editions can differ: Hyundai’s [August 2026 update](https://www.hyundai.com/in/en/hyundai-story/media-center/press-release/hmi-strengthens-ev-ownership) announces revised range figures; these are deliberately not mixed into the launch-brochure records. Owners should match their actual edition or use a custom profile. The neutral SVG car illustration is original EV Network artwork, carries no manufacturer logo and does not represent a specific vehicle photograph.

## Calculation rules and data gaps

- Estimated distance to reserve = published pack capacity × (current SOC − reserve SOC) / consumption in kWh per 100 km. Certified range never supplies consumption or substitutes for trip range. Published capacity is a proxy because usable capacity is not documented. Initial consumption of 16 is an explicitly editable planning assumption.
- Connector matching returns compatible, incompatible or unknown. A confirmed shared type is a match; a complete, known, disjoint list is incompatible. Partial or missing records are unknown. No adapter is assumed. Known incompatible stops are excluded. An optional strict setting excludes unknown stops as well; including them makes the plan conditional.
- Charging time requires a matching connector, vehicle limit and unambiguous station output rating. The ceiling is the lower vehicle/charger limit. Without a documented charging curve, average power is the ceiling × the user’s average-charge fraction (default 0.7), with an explicit efficiency assumption (default 0.9). Sustained peak power cannot be selected. A source-backed SOC-band model is supported and tested, but none of these catalogue editions documents a full curve. Published partial charging windows are displayed as references and are not extrapolated. Ambiguous multi-output ratings and unspecified NACS AC/DC mode stay unknown.
- Charging energy cost is modeled input energy × a known nonnegative station tariff, including a documented zero tariff. Unknown tariffs stay unknown. Session/parking fees are excluded and the operator’s actual metering basis can differ.
- The active 282 station records provide no connector, charging-power or tariff observations. They therefore display **Compatibility unknown**. The confirmed-compatible filter honestly produces zero matches. It does not imply zero chargers exist. Real charging availability, queues and working condition remain unverified.
- Google road routing still uses actual entered start/end coordinates and source-station waypoints. No charging is assumed at an arbitrary start. The stop selector remains a disclosed corridor heuristic, not an optimal itinerary. Existing geographic fallback is clearly labelled. Gemini receives only calculated scalars and now handles unknown charging minutes without inventing a value.

## Verification

**Automated:** 107 backend tests and 31 frontend tests pass. Python lint, frontend lint, formatting check and production build pass. Coverage includes separate variant identity, authoritative capacity, recalculation, missing catalogue editions, custom input bounds/nonfinite values, mandatory consumer vehicle selection, conservative connector aliases, incompatible/strict-unknown stop exclusion, both charging limits, incomplete charging curves, unknown timing/tariffs, free tariffs, local persistence/default/removal, invalid saved records and Gemini null charging time.

**Desktop browser:** regular desktop view and a final requested 1280 × 800 viewport were checked (1164 CSS-pixel layout width at the current browser scale). Station browsing without a vehicle; disabled battery trip calculation before selection; searching Tiago; manufacturer/model/trim selection; confirmation; current charge/reserve entry; saving multiple vehicles; default selection and reload; invalid custom name and zero consumption; valid custom capacity/connectors/limits; confirmed-connector filtering and clear filter; switching saved profiles and preserving trip endpoints. At identical 75% charge, 15% reserve and 16 kWh/100 km, a 27.918 km Google road trip returned 51.7% arrival charge for Tiago XT MR (19.2 kWh) and 56.4% for XT LR (24 kWh). The previous result cleared before recalculation. Estimated distance to reserve changed from 72 to 90 km.

**Mobile browser:** requested viewport 390 × 844 (354 CSS-pixel layout width at the browser’s current scale). Search for 52.9, MG → Windsor EV → Essence Pro selection, confirmation summary, single-column input fields and scrolling were verified. The close header remains visible during scroll and confirmation begins at the top. Document width and scroll width both measured 354 CSS pixels: no horizontal overflow. Temporary viewport override was reset. This is browser viewport verification, not a physical-device field test.

**Live conditional charging:** MG Essence Pro, 16% starting charge, 10% reserve, 16 kWh/100 km, public Delhi–Gurugram coordinates. Google rerouted through the observed New Udaan Bhawan AdPod 1 record: 34.2 km, 61.9 min, one modeled charge, 85.4% modeled arrival. The UI explicitly showed a conditional connector warning, unknown charging time and unknown tariff/cost. These figures are evidence of the modeled flow, not confirmation that the charger is usable.

Garage removal is exercised by state/round-trip tests; no existing user-saved records were deleted through the browser. Real GPS permission and Gemini billing/authentication were not exercised for this vehicle upgrade. Existing two Python dependency deprecation warnings and the MapLibre large-chunk build warning remain; all checks completed successfully.

## Evidence and local run

- [Desktop chosen vehicle and station map](../screenshots/38-vehicle-desktop.jpg)
- [Mobile confirmation screen](../screenshots/39-vehicle-mobile.jpg)
- [Conditional charging route](../screenshots/40-vehicle-conditional-trip.jpg)
- Catalogue: `data/vehicles/catalog.json`
- Active station snapshot: `2ee144cf5153486e90e9cd0ba969a857`; source SHA-256 `c6a8f921195877a474c47c7a524e117bc72e18f6ba4f39a4f73865bcd1092f20`.
- App: http://127.0.0.1:5173/; backend: http://127.0.0.1:8001/.
