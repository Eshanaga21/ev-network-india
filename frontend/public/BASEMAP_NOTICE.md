# Local basemap attribution

`world.geojson` contains Natural Earth 1:110m administrative country polygons, downloaded from the Natural Earth maintainer's public repository:

https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_110m_admin_0_countries.geojson

Natural Earth data are public domain: https://www.naturalearthdata.com/about/terms-of-use/

These generalized polygons provide geographic context only. Their territorial boundaries are cartographic, not official Indian boundaries. They are not roads, station data, coverage areas or location verification. The app uses no remote basemap tile service.

`regions.geojson` contains only the six selected Indian state polygons from the same maintainer's Natural Earth 1:10m administrative provinces dataset:

https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_admin_1_states_provinces.geojson

`frontend/src/regionGeometry.ts` derives map-fit bounds from these polygons. They are cartographic context, not official boundaries or station locations. City labels use the locations of imported records; cluster counts are computed by MapLibre from the actual visible source points.
