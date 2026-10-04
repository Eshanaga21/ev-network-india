# EV Charging Network Analysis & Optimization

A Streamlit-based academic project that applies graph theory and geospatial analysis to a documented extract of real EV charging-station records. It is designed for a viva: each dashboard result is either calculated from the loaded data or visibly labelled as a model estimate.

## Problem statement and motivation

Charging infrastructure is spatially distributed and its usefulness depends on reachability, port availability, and resilience—not just station counts. This project analyses a station network, identifies central or fragile topology, compares shortest-path algorithms, examines relative accessibility, and simulates expansion or station outages.

## Dataset

The checked-in offline input is `data/raw/eamrit_india_charging_stations.json`: a 160-record extract retrieved on **2026-09-10** from the [E-Amrit / NITI Aayog Charging Station Locator](https://e-amrit.niti.gov.in/charging-station-locators). It contains Indian station records across multiple states, with name, coordinate, city, state, and source-recorded availability fields.

This is a real public-data extract, not a national census, real-time availability feed, or utilization dataset. Its availability field is a source record, not per-port live occupancy. The extract does not provide connector types, port counts, measured charging kW, or sessions; the app does not invent them.

To refresh the offline extract:

```bash
curl -k -L 'https://e-amrit.niti.gov.in/getChargingStation' \
  -o data/raw/eamrit_india_charging_stations.json
```

## Architecture and pipeline

`Raw E-Amrit JSON → validation → cleaning/standardization → geographic features → weighted graph → algorithms → Streamlit visualizations`

Cleaning validates coordinates, removes duplicate IDs, normalizes fields, and preserves missing connector/power information as missing rather than filling it. The source/quality panel displays the resulting audit.

## Graph model

`G = (V, E)`: each E-Amrit station is a node with its source location and status attributes. Edges are a disclosed **geographic-proximity model**, created either by a Haversine radius or k-nearest neighbours. They are not road segments. Edge attributes are Haversine distance and a 45 km/h modeled travel time.

This offline project deliberately does not fabricate road links. A production extension may download an OSMnx road graph during preprocessing and replace the edge distance/time fields with road-network values.

## Features and algorithms

- Infrastructure EDA: station geography, source-recorded availability, state and city distribution.
- Network graph: weighted adjacency list, degree/weighted degree, degree centrality, betweenness, closeness, PageRank, components, bridges, and articulation points.
- Routing: measured Dijkstra and A* runtimes; A* uses Haversine as an admissible heuristic for distance weights.
- EV trip model: sequential battery SOC, modeled charge stops, energy added, and charging time from explicit user inputs.
- Resilience: real node-removal simulation with before/after components, density, reachability, and average within-component path length.
- Accessibility: configurable 0–100 relative index combining nearest-station distance, nearby-station density, recorded availability, and graph degree.
- Expansion: deterministic candidates from midpoints of real station gaps, followed by an actual graph-addition comparison.

## Installation, running, and testing

```bash
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate
pip install -r requirements.txt
streamlit run app.py
pytest -q
```

## Assumptions and limitations

- Geography is Haversine distance, not road routing, traffic, elevation, or weather.
- The displayed travel time assumes 45 km/h and is clearly modeled.
- Battery and charging calculations use user-entered consumption, power, target SOC, and efficiency; no real-time charging/occupancy data are implied.
- Expansion candidates do not use demand, population, grid constraints, land suitability, pricing, or traffic because this dataset has none.
- The accessibility index is relative to the current filter, not an official accessibility or policy score.

## Future work

Replace proximity edges with cached OSMnx road-network routing; ingest an expanded verified India snapshot with connector data; add real demand/session data only when licensed and available; include traffic, price, and EV-specific charging curves; and evaluate demand prediction only with suitable historical observations.

## Screenshots

Add screenshots of Overview, Network Graph, Route Engine, Resilience Lab, Accessibility Index, and Expansion Planner here after running the application.
