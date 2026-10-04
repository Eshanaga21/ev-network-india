import streamlit as st
from src.data_loader import DATASET_METADATA
from src.ui import apply_theme, page_header

apply_theme(); page_header("METHODOLOGY", "What is calculated — and what is assumed", "A viva-ready guide to the project’s data provenance, graph construction, algorithms, and limitations.")
st.markdown(f"""### Data source
**[{DATASET_METADATA['source']}]({DATASET_METADATA['url']})**  
{DATASET_METADATA['extract']} · retrieved **{DATASET_METADATA['retrieved']}**.  
Coverage: {DATASET_METADATA['coverage']}.

### Pipeline
`Raw AFDC CSV → coordinate / duplicate validation → standard fields → port-type features → weighted station graph → analysis → visualisation`

### Graph model
Each station record is a node. Edges are an explicit **geographic-proximity model**, created either inside the selected Haversine radius or through k-nearest neighbours. They are not claimed to be road links. Edge attributes are geographic distance, a 45 km/h estimated travel time, and an EV route cost that modestly penalises links with no reported DC-fast ports.

### Shortest paths
**Dijkstra** calculates the minimum weighted route. **A*** uses Haversine distance as an admissible heuristic for geographic-distance weights; both should return the same shortest distance, with measured runtime shown in the app.

### Accessibility index
Within the active filter, min–max normalized components are combined as:  
`100 × [distance weight × (1 − nearest-distance) + port weight × ports + DC-fast weight × fast ports + connectivity weight × degree]`.
Weights are user-set and must sum to 100%. It is a relative analytical index, not an official policy metric.

### Expansion candidates
Candidates are deterministic midpoints of pairs of **real recorded stations** 8–60 km apart. Scores favour larger observed station gaps and fewer nearby records. No demand, traffic, land, grid capacity, road routing, or utilization is invented.

### EV trip simulation
Energy consumption, battery SOC, charging power, target SOC, and charging efficiency are user inputs. The result is a modeled estimate: no live occupancy, measured kW, taper curve, elevation, or traffic data is available in this extract.

### Known limitations
{DATASET_METADATA['limitations']} The offline extract is limited to 200 records, so it is suitable for reproducible academic analysis rather than statewide infrastructure planning.
""")
