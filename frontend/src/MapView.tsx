import { useCallback, useEffect, useRef, useState } from "react";
import * as maplibregl from "maplibre-gl";
import workerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";
maplibregl.setWorkerUrl(workerUrl);
import type { GeoJSONSource, Map as LibreMap } from "maplibre-gl";
import { Layers, LocateFixed, Minus, Plus } from "lucide-react";
import type { Station } from "./types";
import { useUI } from "./store";
import { REGION_BOUNDS } from "./regionGeometry";
const collection = (features: any[]) =>
  ({ type: "FeatureCollection", features }) as GeoJSON.FeatureCollection;
export default function MapView({
  stations,
  edges,
  route,
  candidates,
  clusters,
  simple = false,
  region = "",
  onPointPick,
  enteredPoints = [],
}: {
  stations: Station[];
  edges: any[];
  route: any;
  candidates: any[];
  clusters: any;
  simple?: boolean;
  region?: string;
  onPointPick?: (latitude: number, longitude: number) => void;
  enteredPoints?: { latitude: number; longitude: number; label: string }[];
}) {
  const element = useRef<HTMLDivElement>(null),
    map = useRef<LibreMap | null>(null);
  const [ready, setReady] = useState(false),
    [error, setError] = useState("");
  const { settings, selected, select, set } = useUI();
  const metric = simple
    ? "station"
    : settings.tab === "Accessibility"
      ? "score"
      : settings.tab === "Network Graph"
        ? settings.nodeMetric
        : settings.tab === "Infrastructure" &&
            settings.nodeMetric === "cluster_id"
          ? "cluster_id"
          : stations.some((s) => s.status != null)
            ? "status"
            : "availability";
  const fitKey = stations
    .map((s) => `${s.station_id}:${s.latitude}:${s.longitude}`)
    .join("|");
  const pointPickRef = useRef(onPointPick);
  pointPickRef.current = onPointPick;
  const stationRef = useRef(stations);
  stationRef.current = stations;
  const fit = useCallback(() => {
    const m = map.current;
    if (!m) return;
    m.setPadding({ top: 0, bottom: 0, left: 0, right: 0 });
    if (simple && region && REGION_BOUNDS[region]) {
      m.fitBounds(REGION_BOUNDS[region], {
        padding: 60,
        duration: 700,
      });
      return;
    }
    if (!stationRef.current.length) return;
    const bounds = new maplibregl.LngLatBounds();
    stationRef.current.forEach((s) => bounds.extend([s.longitude, s.latitude]));
    m.fitBounds(bounds, {
      padding: simple
        ? { top: 100, bottom: 70, left: 80, right: 80 }
        : { top: 110, bottom: 230, left: 60, right: 60 },
      maxZoom: 11,
      duration: 800,
    });
  }, [simple, region]);
  useEffect(() => {
    if (!element.current) return;
    const m = new maplibregl.Map({
      container: element.current,
      center: simple ? [77.1, 29] : [79, 22],
      zoom: simple ? 6 : 4.2,
      style: {
        version: 8,
        sources: {
          world: {
            type: "geojson",
            data: "/world.geojson",
            attribution:
              "Natural Earth · public domain · boundaries are cartographic, not official",
          },
        },
        layers: [
          {
            id: "background",
            type: "background",
            paint: { "background-color": simple ? "#101c20" : "#090f18" },
          },
          {
            id: "land",
            type: "fill",
            source: "world",
            paint: {
              "fill-color": simple ? "#263033" : "#131f2c",
              "fill-opacity": 0.7,
            },
          },
          {
            id: "borders",
            type: "line",
            source: "world",
            paint: {
              "line-color": simple ? "#56605c" : "#334155",
              "line-width": 0.8,
            },
          },
        ],
      },
      attributionControl: false,
    });
    m.addControl(
      new maplibregl.AttributionControl({ compact: true }),
      "bottom-right",
    );
    map.current = m;
    m.on("load", () => {
      if (simple) {
        m.addSource("regions", { type: "geojson", data: "/regions.geojson" });
        m.addLayer({
          id: "region-fill",
          type: "fill",
          source: "regions",
          paint: { "fill-color": "#354638", "fill-opacity": 0.28 },
        });
        m.addLayer({
          id: "region-lines",
          type: "line",
          source: "regions",
          paint: {
            "line-color": "#687c66",
            "line-opacity": 0.6,
            "line-width": 1,
          },
        });
      }
      for (const id of ["stations", "edges", "route", "candidates", "entered"])
        m.addSource(id, {
          type: "geojson",
          data: collection([]),
          ...(simple && id === "stations"
            ? { cluster: true, clusterRadius: 36, clusterMaxZoom: 11 }
            : {}),
        });
      m.addLayer({
        id: "edge-lines",
        type: "line",
        source: "edges",
        paint: {
          "line-color": ["case", ["get", "highlight"], "#ffba62", "#6a9b9a"],
          "line-width": ["case", ["get", "highlight"], 3, ["get", "width"]],
          "line-opacity": 0.4,
        },
      });
      m.addLayer({
        id: "density",
        type: "heatmap",
        source: "stations",
        paint: {
          "heatmap-weight": 1,
          "heatmap-intensity": 0.8,
          "heatmap-radius": 35,
          "heatmap-opacity": 0.5,
          "heatmap-color": [
            "interpolate",
            ["linear"],
            ["heatmap-density"],
            0,
            "rgba(32,65,62,0)",
            0.3,
            "#277062",
            0.7,
            "#6ebd83",
            1,
            "#baf9b0",
          ],
        },
        layout: { visibility: "none" },
      });
      m.addLayer({
        id: "route-glow",
        type: "line",
        source: "route",
        paint: {
          "line-color": simple ? "#7fdfc4" : "#a2ef72",
          "line-width": 8,
          "line-opacity": 0.1,
        },
      });
      m.addLayer({
        id: "route-line",
        type: "line",
        source: "route",
        paint: {
          "line-color": simple ? "#7fdfc4" : "#a2ef72",
          "line-width": 3,
          "line-dasharray": [2, 1],
        },
      });
      m.addLayer({
        id: "station-halo",
        type: "circle",
        source: "stations",
        ...(simple
          ? {
              filter: [
                "!",
                ["has", "point_count"],
              ] as maplibregl.FilterSpecification,
            }
          : {}),
        paint: {
          "circle-radius": ["case", ["get", "selected"], 14, 7],
          "circle-color": ["get", "color"],
          "circle-opacity": 0.13,
        },
      });
      m.addLayer({
        id: "station-points",
        type: "circle",
        source: "stations",
        ...(simple
          ? {
              filter: [
                "!",
                ["has", "point_count"],
              ] as maplibregl.FilterSpecification,
            }
          : {}),
        paint: {
          "circle-radius": [
            "interpolate",
            ["linear"],
            ["zoom"],
            3,
            3,
            8,
            6,
            13,
            8,
          ],
          "circle-color": ["get", "color"],
          "circle-stroke-color": simple ? "#d2faeb" : "#0d1923",
          "circle-stroke-width": 1.3,
        },
      });
      m.addLayer({
        id: "candidate-points",
        type: "circle",
        source: "candidates",
        paint: {
          "circle-radius": 9,
          "circle-color": "#ffbf69",
          "circle-stroke-color": "#ffd9a2",
          "circle-stroke-width": 2,
          "circle-opacity": 0.8,
        },
      });
      m.addLayer({
        id: "entered-points",
        type: "circle",
        source: "entered",
        paint: {
          "circle-radius": 9,
          "circle-color": "#dfffd0",
          "circle-stroke-color": "#080e16",
          "circle-stroke-width": 3,
        },
      });
      setReady(true);
    });
    m.on("click", (e) => {
      if (
        pointPickRef.current &&
        e.lngLat.lat >= 6 &&
        e.lngLat.lat <= 38 &&
        e.lngLat.lng >= 68 &&
        e.lngLat.lng <= 98
      )
        pointPickRef.current(e.lngLat.lat, e.lngLat.lng);
    });
    m.on("click", "station-points", (e) => {
      if (pointPickRef.current) return;
      const id = e.features?.[0]?.properties?.station_id;
      if (id) useUI.getState().select(id);
    });
    m.on("mouseenter", "station-points", () => {
      m.getCanvas().style.cursor = "pointer";
    });
    m.on("mouseleave", "station-points", () => {
      m.getCanvas().style.cursor = "";
    });
    m.on("error", () =>
      setError(
        "A map layer could not load. Station coordinates and analysis remain available in the tables.",
      ),
    );
    const observer = new ResizeObserver(() => m.resize());
    observer.observe(element.current);
    return () => {
      observer.disconnect();
      m.remove();
      map.current = null;
    };
  }, [simple]);
  useEffect(() => {
    if (!ready || !map.current) return;
    fit();
  }, [ready, fitKey, settings.tab, fit]); // fit each workspace to its current imported coordinates
  useEffect(() => {
    const m = map.current;
    if (!ready || !m) return;
    const clusterMap = new Map(
      (clusters?.stations || []).map((s: any) => [s.station_id, s.cluster_id]),
    );
    const maxMetric = Math.max(
      1,
      ...stations.map((s) => Number(s[metric]) || 0),
    );
    const colors = ["#9fed7b", "#7bafff", "#ffbd66", "#cba5ef", "#4dd8ce"];
    const features = stations.map((s) => {
      let color = simple
        ? s.station_id === selected
          ? "#f8edab"
          : "#7fdfc4"
        : "#6e8399";
      if (simple) {
        color = s.station_id === selected ? "#f8edab" : "#7fdfc4";
      } else if (metric === "availability") {
        const raw = String(s.availability).toLowerCase();
        color = ["1", "1.0", "available", "true"].includes(raw)
          ? "#a2ef72"
          : ["0", "0.0", "unavailable", "false"].includes(raw)
            ? "#ef7b7b"
            : "#6e8399";
      } else if (metric === "status") {
        const raw = String(s.status).toLowerCase();
        color = /offline|closed|out of service/.test(raw)
          ? "#ef7b7b"
          : /operational|open|available/.test(raw)
            ? "#a2ef72"
            : "#6e8399";
      } else if (metric === "component_id")
        color = colors[((s.component_id || 1) - 1) % colors.length];
      else if (metric === "cluster_id") {
        const id = Number(clusterMap.get(s.station_id) ?? -1);
        color = id < 0 ? "#6e8399" : colors[id % colors.length];
      } else {
        const value = (Number(s[metric]) || 0) / maxMetric;
        color = value > 0.66 ? "#a2ef72" : value > 0.33 ? "#ffbd66" : "#6e8399";
      }
      if (!simple && settings.highlight === "articulation" && s.articulation)
        color = "#ffbd66";
      return {
        type: "Feature",
        geometry: { type: "Point", coordinates: [s.longitude, s.latitude] },
        properties: {
          station_id: s.station_id,
          color,
          selected: s.station_id === selected,
        },
      };
    });
    (m.getSource("stations") as GeoJSONSource).setData(collection(features));
    const lookup = new Map(stations.map((s) => [s.station_id, s]));
    const shownEdges = !simple && settings.tab === "Network Graph" ? edges : [];
    const maxEdge = shownEdges.reduce(
      (max, e) => Math.max(max, Number(e[settings.edgeMetric]) || 0),
      1,
    );
    (m.getSource("edges") as GeoJSONSource).setData(
      collection(
        shownEdges
          .filter((e) => lookup.has(e.source) && lookup.has(e.target))
          .map((e) => {
            const a = lookup.get(e.source)!,
              b = lookup.get(e.target)!;
            return {
              type: "Feature",
              geometry: {
                type: "LineString",
                coordinates: [
                  [a.longitude, a.latitude],
                  [b.longitude, b.latitude],
                ],
              },
              properties: {
                highlight: settings.highlight === "bridges" && e.bridge,
                width:
                  0.5 + (2 * (Number(e[settings.edgeMetric]) || 0)) / maxEdge,
              },
            };
          }),
      ),
    );
    (m.getSource("route") as GeoJSONSource).setData(
      collection(
        route?.found && (simple || settings.tab === "Trip Planner")
          ? [
              {
                type: "Feature",
                geometry: route.road_route?.geometry || {
                  type: "LineString",
                  coordinates: [
                    route.origin,
                    ...route.stations,
                    route.destination,
                  ].map((s: Station) => [s.longitude, s.latitude]),
                },
                properties: {},
              },
            ]
          : [],
      ),
    );
    (m.getSource("entered") as GeoJSONSource).setData(
      collection(
        route?.origin && (simple || settings.tab === "Trip Planner")
          ? [route.origin, route.destination].map((p) => ({
              type: "Feature",
              geometry: {
                type: "Point",
                coordinates: [p.longitude, p.latitude],
              },
              properties: {},
            }))
          : [],
      ),
    );
    (m.getSource("candidates") as GeoJSONSource).setData(
      collection(
        !simple && settings.tab === "Expansion"
          ? candidates.map((c) => ({
              type: "Feature",
              geometry: {
                type: "Point",
                coordinates: [c.longitude, c.latitude],
              },
              properties: { candidate_id: c.candidate_id },
            }))
          : [],
      ),
    );
    m.setLayoutProperty(
      "density",
      "visibility",
      !simple && settings.heatmap ? "visible" : "none",
    );
  }, [
    ready,
    stations,
    edges,
    route,
    candidates,
    clusters,
    metric,
    simple,
    settings.edgeMetric,
    settings.highlight,
    settings.tab,
    settings.heatmap,
    selected,
  ]);
  useEffect(() => {
    const m = map.current;
    if (
      !ready ||
      !m ||
      !route?.origin ||
      (!simple && settings.tab !== "Trip Planner")
    )
      return;
    const bounds = new maplibregl.LngLatBounds();
    [...(route.stations || []), route.origin, route.destination].forEach(
      (s: Station) => bounds.extend([s.longitude, s.latitude]),
    );
    m.setPadding({ top: 0, bottom: 0, left: 0, right: 0 });
    m.fitBounds(bounds, {
      padding: simple
        ? { top: 100, bottom: 90, left: 80, right: 80 }
        : { top: 130, bottom: 240, left: 90, right: 90 },
      maxZoom: 11,
      duration: 700,
    });
  }, [ready, route, settings.tab, simple]);
  useEffect(() => {
    const m = map.current;
    if (!m || !ready || !simple) return;
    const s = stations.find((item) => item.station_id === selected);
    if (s)
      m.easeTo({
        center: [s.longitude, s.latitude],
        zoom: Math.max(10, m.getZoom()),
        duration: 650,
      });
  }, [ready, simple, selected, stations]);
  useEffect(() => {
    const m = map.current;
    if (!m || !ready || !simple) return;
    if (!fitKey) return;
    const markers = new Map<number, maplibregl.Marker>();
    const update = () => {
      const active = new Set<number>();
      for (const f of m.querySourceFeatures("stations")) {
        const props = f.properties;
        if (!props?.cluster || f.geometry.type !== "Point") continue;
        const id = Number(props.cluster_id);
        active.add(id);
        const existing = markers.get(id);
        const button =
          existing?.getElement() || document.createElement("button");
        button.classList.add("finder-cluster-count");
        button.textContent = String(props.point_count);
        button.setAttribute("aria-label", `Show ${props.point_count} stations`);
        const coords = f.geometry.coordinates as [number, number];
        button.onclick = () => {
          void (m.getSource("stations") as GeoJSONSource)
            .getClusterExpansionZoom(id)
            .then((zoom) =>
              m.easeTo({ center: coords, zoom: zoom + 0.2, duration: 650 }),
            );
        };
        if (existing) existing.setLngLat(coords);
        else
          markers.set(
            id,
            new maplibregl.Marker({ element: button })
              .setLngLat(coords)
              .addTo(m),
          );
      }
      for (const [id, marker] of markers)
        if (!active.has(id)) {
          marker.remove();
          markers.delete(id);
        }
    };
    m.on("render", update);
    return () => {
      m.off("render", update);
      markers.forEach((marker) => marker.remove());
    };
  }, [ready, simple, fitKey]);
  useEffect(() => {
    const m = map.current;
    if (!m || !ready || !simple) return;
    const byCity = new Map<string, { station: Station; count: number }>();
    for (const station of stations) {
      if (!station.city) continue;
      const key = `${station.state}:${station.city.toLowerCase()}`;
      const existing = byCity.get(key);
      byCity.set(key, { station, count: (existing?.count || 0) + 1 });
    }
    // One observed city label per state keeps the overview readable.
    const byState = new Map<string, Station>();
    for (const { station } of [...byCity.values()].sort(
      (a, b) => b.count - a.count,
    )) {
      if (!byState.has(station.state || ""))
        byState.set(station.state || "", station);
    }
    const cityStations = [...byState.values()];
    const markers = cityStations.map((s) => {
      const label = document.createElement("span");
      label.className = "finder-city-label";
      label.textContent = s.city;
      const offset: [number, number] =
        s.city === "Noida" ? [35, 20] : [-15, -24];
      return new maplibregl.Marker({ element: label, offset })
        .setLngLat([s.longitude, s.latitude])
        .addTo(m);
    });
    return () => markers.forEach((marker) => marker.remove());
  }, [ready, simple, stations]);
  const pointKey = JSON.stringify(enteredPoints);
  useEffect(() => {
    const m = map.current;
    if (!ready || !m || !simple) return;
    m.getCanvas().style.cursor = onPointPick ? "crosshair" : "";
  }, [ready, simple, onPointPick]);
  useEffect(() => {
    const m = map.current;
    if (!ready || !m || !simple) return;
    const points: typeof enteredPoints = JSON.parse(pointKey);
    const markers = points.map((p) => {
      const label = document.createElement("span");
      label.className = "finder-endpoint-pin";
      label.textContent = p.label;
      label.setAttribute(
        "aria-label",
        p.label === "A" ? "Starting point" : "Destination",
      );
      return new maplibregl.Marker({ element: label })
        .setLngLat([p.longitude, p.latitude])
        .addTo(m);
    });
    if (points.length) {
      const bounds = new maplibregl.LngLatBounds();
      points.forEach((p) => bounds.extend([p.longitude, p.latitude]));
      m.setPadding({ top: 0, bottom: 0, left: 0, right: 0 });
      m.fitBounds(bounds, { padding: 90, maxZoom: 11, duration: 600 });
    }
    return () => markers.forEach((marker) => marker.remove());
  }, [ready, simple, pointKey]);
  return (
    <div className="map-shell">
      <div
        className="map-canvas"
        ref={element}
        aria-label="Geographic map of imported station coordinates"
      />
      <div className="map-caption">
        <span className="pulse" /> GEOGRAPHIC PROXIMITY MODEL{" "}
        <small>Edges are not roads</small>
      </div>
      <div className="map-tools">
        <button aria-label="Zoom in" onClick={() => map.current?.zoomIn()}>
          <Plus size={18} />
        </button>
        <button aria-label="Zoom out" onClick={() => map.current?.zoomOut()}>
          <Minus size={18} />
        </button>
        <button aria-label="Fit imported stations" onClick={fit}>
          <LocateFixed size={18} />
        </button>
        {!simple && (
          <button
            aria-label="Toggle source station density heatmap"
            aria-pressed={settings.heatmap}
            onClick={() => set({ heatmap: !settings.heatmap })}
          >
            <Layers size={18} />
          </button>
        )}
      </div>
      <div className="map-legend">
        <span>
          <i className="green" />
          Source code 1 / high metric
        </span>
        <span>
          <i className="amber" />
          Calculated highlight / candidate
        </span>
        <span>
          <i className="red" />
          Source code 0 / offline
        </span>
        <span>
          <i />
          Unknown / low metric
        </span>
      </div>
      {error && (
        <div className="map-error" role="status">
          {error}
        </div>
      )}
      <button
        className="map-deselect"
        hidden={!selected}
        onClick={() => select(null)}
      >
        Clear station selection
      </button>
    </div>
  );
}
