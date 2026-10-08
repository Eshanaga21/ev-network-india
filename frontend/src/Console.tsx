import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Activity,
  ArrowRight,
  BookOpen,
  ChevronDown,
  CircleHelp,
  Database,
  Download,
  FileText,
  GitBranch,
  Layers,
  MapPin,
  Navigation,
  Plus,
  Route as RouteIcon,
  Save,
  Search,
  Settings2,
  Shield,
  Sparkles,
  Trash2,
  X,
  Zap,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { download, exportData, format, request } from "./api";
import { context, endpointValid, resolveEndpoint, useUI } from "./store";
import type { Dataset, Endpoint, Station, Tab } from "./types";
import {
  Explain,
  ExportButtons,
  Loading,
  Metric,
  Modal,
  Notice,
  Num,
  Table,
  Tag,
  Viva,
} from "./shared";
import MapView from "./MapView";
const tabs: { name: Tab; icon: typeof Navigation }[] = [
  { name: "Trip Planner", icon: Navigation },
  { name: "Infrastructure", icon: Layers },
  { name: "Network Graph", icon: GitBranch },
  { name: "Resilience", icon: Shield },
  { name: "Accessibility", icon: Activity },
  { name: "Expansion", icon: Sparkles },
  { name: "Methodology", icon: BookOpen },
];
const copy: Record<
  Tab,
  { kicker: string; title: string; description: string }
> = {
  "Trip Planner": {
    kicker: "01 / GEOGRAPHIC ROUTING",
    title: "Plan a modeled EV trip",
    description:
      "Find a path through real stations. Test your battery assumptions along the way.",
  },
  Infrastructure: {
    kicker: "02 / SOURCE OBSERVATIONS",
    title: "Understand the footprint",
    description:
      "Explore imported locations, source fields, and geographic concentration.",
  },
  "Network Graph": {
    kicker: "03 / GRAPH INTELLIGENCE",
    title: "See the connections",
    description:
      "Study centrality, components and structural dependencies in the proximity graph.",
  },
  Resilience: {
    kicker: "04 / WHAT-IF ANALYSIS",
    title: "Test network resilience",
    description:
      "Remove a station in a simulation copy and measure the actual graph impact.",
  },
  Accessibility: {
    kicker: "05 / RELATIVE ACCESS",
    title: "Measure relative accessibility",
    description:
      "Build a transparent index using available observations and graph connectivity.",
  },
  Expansion: {
    kicker: "06 / GEOGRAPHIC GAPS",
    title: "Explore potential expansion",
    description:
      "Deterministic geographic candidates derived from real station geometry.",
  },
  Methodology: {
    kicker: "07 / VIVA WORKSPACE",
    title: "Explain every result",
    description:
      "Algorithms, assumptions, source capabilities and reproducible analysis.",
  },
};
const stationColumns = [
  { key: "station_name", label: "Station" },
  { key: "city", label: "City" },
  { key: "state", label: "State" },
  { key: "availability", label: "Source availability" },
  { key: "degree", label: "Degree" },
  { key: "data_completeness_pct", label: "Completeness %" },
];
function StationPicker({
  label,
  value,
  onChange,
  stations,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  stations: Station[];
}) {
  const [search, setSearch] = useState("");
  const options = stations.filter((s) =>
    `${s.station_name} ${s.city || ""} ${s.state || ""}`
      .toLowerCase()
      .includes(search.toLowerCase()),
  );
  return (
    <div className="station-picker">
      <label className="field">
        <span>{label} — search loaded names, city or state</span>
        <div className="search-input">
          <Search size={14} />
          <input
            aria-label={`${label} search`}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Station, city or state…"
          />
        </div>
      </label>
      <label className="field">
        <span className="sr-only">{label} station</span>
        <select
          aria-label={`${label} station`}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        >
          <option value="">Select a real station</option>
          {value &&
            !options.some((s) => s.station_id === value) &&
            stations.find((s) => s.station_id === value) && (
              <option value={value}>
                {stations.find((s) => s.station_id === value)?.station_name}
              </option>
            )}
          {options.map((s) => (
            <option key={s.station_id} value={s.station_id}>
              {s.station_name} · {s.city || s.state || "Location not named"}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
function EndpointInput({
  label,
  point,
  onChange,
  stations,
}: {
  label: string;
  point: Endpoint;
  onChange: (value: Endpoint) => void;
  stations: Station[];
}) {
  return (
    <div className="endpoint">
      <div className="endpoint-title">
        <i className={label === "Destination" ? "destination" : ""} />
        <strong>{label}</strong>
        <div className="segmented small">
          <button
            aria-pressed={point.mode === "station"}
            className={point.mode === "station" ? "active" : ""}
            onClick={() => onChange({ ...point, mode: "station" })}
          >
            Station
          </button>
          <button
            aria-pressed={point.mode === "coordinates"}
            className={point.mode === "coordinates" ? "active" : ""}
            onClick={() => onChange({ ...point, mode: "coordinates" })}
          >
            Coordinates
          </button>
        </div>
      </div>
      {point.mode === "station" ? (
        <StationPicker
          label={label}
          value={point.station_id}
          onChange={(station_id) => onChange({ ...point, station_id })}
          stations={stations}
        />
      ) : (
        <div className="two-col">
          <label className="field">
            <span>{label} latitude</span>
            <input
              type="number"
              value={point.latitude}
              min={6}
              max={38}
              step="any"
              placeholder="Latitude °N"
              onChange={(e) => onChange({ ...point, latitude: e.target.value })}
            />
          </label>
          <label className="field">
            <span>{label} longitude</span>
            <input
              type="number"
              value={point.longitude}
              min={68}
              max={98}
              step="any"
              placeholder="Longitude °E"
              onChange={(e) =>
                onChange({ ...point, longitude: e.target.value })
              }
            />
          </label>
        </div>
      )}
    </div>
  );
}
function GraphControls() {
  const { settings, set } = useUI();
  const update = (part: any) => set({ graph: { ...settings.graph, ...part } });
  return (
    <details className="graph-controls">
      <summary>
        <Settings2 size={14} /> Graph model{" "}
        <span>
          {settings.graph.method === "radius"
            ? `${settings.graph.radius_km} km radius`
            : `${settings.graph.k} nearest`}
        </span>
        <ChevronDown size={13} />
      </summary>
      <div className="details-body">
        <div className="segmented">
          <button
            className={settings.graph.method === "radius" ? "active" : ""}
            onClick={() => update({ method: "radius" })}
          >
            Radius graph
          </button>
          <button
            className={settings.graph.method === "knn" ? "active" : ""}
            onClick={() => update({ method: "knn" })}
          >
            k-nearest neighbor
          </button>
        </div>
        {settings.graph.method === "radius" ? (
          <Num
            label="Connection radius"
            value={settings.graph.radius_km}
            onChange={(radius_km) => update({ radius_km })}
            min={0.1}
            max={2000}
            step={1}
            unit="km"
          />
        ) : (
          <Num
            label="Neighbors per station"
            value={settings.graph.k}
            onChange={(k) => update({ k })}
            min={1}
            max={25}
          />
        )}
        <Num
          label="Assumed geographic travel speed"
          value={settings.graph.speed_kmh}
          onChange={(speed_kmh) => update({ speed_kmh })}
          min={1}
          max={150}
          unit="km/h"
        />
        <p className="muted">
          Haversine proximity edges. Connectivity is never forced. k-NN is an
          undirected union.
        </p>
      </div>
    </details>
  );
}
function Distribution({
  stations,
  field,
  title,
}: {
  stations: Station[];
  field: string;
  title: string;
}) {
  const counts: Record<string, number> = {};
  stations.forEach((s) => {
    const key = s[field] ?? "Not provided";
    counts[key] = (counts[key] || 0) + 1;
  });
  const rows = Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .map(([name, count]) => ({ name, count }))
    .slice(0, 8);
  return (
    <section className="chart-section">
      <div className="section-title">
        <h3>{title}</h3>
        <Tag kind="observed" />
      </div>
      <div className="chart">
        <ResponsiveContainer width="100%" height={180}>
          <BarChart
            data={rows}
            layout="vertical"
            margin={{ left: 0, right: 20 }}
          >
            <CartesianGrid horizontal={false} stroke="#22303d" />
            <XAxis
              type="number"
              allowDecimals={false}
              tick={{ fill: "#91a1b4", fontSize: 10 }}
            />
            <YAxis
              type="category"
              dataKey="name"
              width={110}
              tick={{ fill: "#b1bfcc", fontSize: 10 }}
            />
            <Tooltip
              contentStyle={{
                background: "#122030",
                border: "1px solid #354457",
                color: "#fff",
              }}
            />
            <Bar dataKey="count" fill="#a2ef72" radius={[0, 3, 3, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <Explain title="Station distribution">
        Counts of the current filtered source records grouped by {field}.
        Missing values form a “Not provided” group. No coverage or demand
        inference.
      </Explain>
    </section>
  );
}
export default function Console({
  dataset,
  onBack,
}: {
  dataset: Dataset;
  onBack?: () => void;
}) {
  const sidebarRef = useRef<HTMLElement>(null);
  const { settings, set, selected, select, panel, show, reset } = useUI(),
    cache = useQueryClient();
  const ctx = context(settings),
    contextKey = JSON.stringify({
      ...ctx,
      snapshot_id: dataset.metadata.snapshot_id,
    });
  useEffect(() => {
    sidebarRef.current?.scrollTo({ top: 0 });
  }, [settings.tab]);
  const analysis = useQuery({
    queryKey: ["analysis", contextKey],
    queryFn: () => request("analysis", ctx),
  });
  const weightsValid =
    Math.abs(Object.values(settings.weights).reduce((a, b) => a + b, 0) - 100) <
    0.001;
  const accessBody = {
    ...ctx,
    radius_km: settings.radius,
    weights: settings.weights,
  };
  const access = useQuery({
    queryKey: ["access", contextKey, settings.radius, settings.weights],
    queryFn: () => request("accessibility", accessBody),
    enabled: settings.tab === "Accessibility" && weightsValid,
  });
  const expandBody = { ...ctx, coverage_radius_km: settings.radius };
  const expand = useQuery({
    queryKey: ["expansion", contextKey, settings.radius],
    queryFn: () => request("expansion", expandBody),
    enabled: settings.tab === "Expansion",
  });
  const cluster = useQuery({
    queryKey: [
      "cluster",
      contextKey,
      settings.clusterRadius,
      settings.minSamples,
    ],
    queryFn: () =>
      request("clusters", {
        ...ctx,
        radius_km: settings.clusterRadius,
        min_samples: settings.minSamples,
      }),
    enabled: settings.tab === "Infrastructure",
  });
  const [routeResult, setRouteResult] = useState<any>(null),
    [outageResult, setOutageResult] = useState<any>(null),
    [comparisonResult, setComparisonResult] = useState<any>(null),
    [resultKey, setResultKey] = useState(""),
    [outageKey, setOutageKey] = useState(""),
    [comparisonKey, setComparisonKey] = useState("");
  const routeBody = {
    ...ctx,
    origin: resolveEndpoint(settings.origin),
    destination: resolveEndpoint(settings.destination),
    algorithm: settings.algorithm,
    vehicle: settings.vehicle,
  };
  const currentRouteKey = JSON.stringify({
    contextKey,
    origin: settings.origin,
    destination: settings.destination,
    algorithm: settings.algorithm,
    vehicle: settings.vehicle,
  });
  const route = useMutation({
    mutationFn: ({ body }: { body: any; key: string }) =>
      request("route", body),
    onSuccess: (data, variables) => {
      setRouteResult(data);
      setResultKey(variables.key);
    },
  });
  const outage = useMutation({
    mutationFn: ({ body }: { body: any; key: string }) =>
      request("resilience", body),
    onSuccess: (data, variables) => {
      setOutageResult(data);
      setOutageKey(variables.key);
    },
  });
  const comparison = useMutation({
    mutationFn: ({ body }: { body: any; key: string }) =>
      request("comparison", body),
    onSuccess: (data, variables) => {
      setComparisonResult(data);
      setComparisonKey(variables.key);
      show("comparison");
    },
  });
  const report = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...ctx,
          route:
            routeResult && resultKey === currentRouteKey ? routeBody : null,
          outage:
            outageResult && outageKey === contextKey + settings.outage
              ? { ...ctx, station_id: settings.outage }
              : null,
          accessibility: weightsValid ? accessBody : { ...ctx },
          expansion: expandBody,
        }),
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(
          typeof data.detail === "string"
            ? data.detail
            : "Report inputs are invalid.",
        );
      }
      download("ev-academic-report.html", await response.text(), "text/html");
    },
  });
  const providers = useQuery({
    queryKey: ["providers"],
    queryFn: () => request("health"),
  });
  const scenarios = useQuery({
    queryKey: ["scenarios"],
    queryFn: () => request("scenarios"),
  });
  const saveScenario = useMutation({
    mutationFn: ({ name, values }: { name: string; values: any }) =>
      request("scenarios", { name, settings: values }),
    onSuccess: () => {
      cache.invalidateQueries({ queryKey: ["scenarios"] });
      set({ scenarioName: "" });
    },
  });
  const loadScenario = useMutation({
    mutationFn: (id: string) => request(`scenarios/${id}/load`, {}),
    onSuccess: (data) => {
      reset();
      set(data.settings);
      select(null);
      cache.invalidateQueries();
      show(null);
    },
  });
  const deleteScenario = useMutation({
    mutationFn: (id: string) => request(`scenarios/${id}`, undefined, "DELETE"),
    onSuccess: () => cache.invalidateQueries({ queryKey: ["scenarios"] }),
  });
  const unload = useMutation({
    mutationFn: () => request("dataset", undefined, "DELETE"),
    onSuccess: () => {
      reset();
      show(null);
      cache.invalidateQueries();
    },
  });
  const routeData = resultKey === currentRouteKey ? routeResult : null,
    outageData =
      outageKey === contextKey + settings.outage ? outageResult : null;
  const compareData =
    comparisonKey === contextKey + JSON.stringify(settings.comparison)
      ? comparisonResult
      : null;
  const stations: Station[] = analysis.data?.stations || [];
  const accessMap = new Map(
    (access.data?.ranking || []).map((s: Station) => [s.station_id, s]),
  );
  const mapStations =
    settings.tab === "Accessibility" && weightsValid && access.data
      ? stations.map((s) => ({
          ...s,
          ...((accessMap.get(s.station_id) as object) || {}),
        }))
      : stations;
  const inspected = stations.find((s) => s.station_id === selected);
  const summary = analysis.data?.summary,
    audit = analysis.data?.audit || dataset.metadata;
  const states = [
    ...new Set(dataset.stations.map((s) => s.state).filter(Boolean)),
  ].sort() as string[];
  const cities = [
    ...new Set(
      dataset.stations
        .filter((s) => !settings.state || s.state === settings.state)
        .map((s) => s.city)
        .filter(Boolean),
    ),
  ].sort() as string[];
  const current = copy[settings.tab];
  const canCompare =
    settings.comparison.length >= 2 && settings.comparison.length <= 4;
  useEffect(() => {
    const close = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        show(null);
        select(null);
      }
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [show, select]);
  return (
    <div className="console">
      <header className="app-header">
        <div className="brand">
          <div className="brand-icon">
            <Zap size={22} />
          </div>
          <div>
            EV NETWORK <span>INTELLIGENCE / INDIA</span>
          </div>
        </div>
        <div className="source-pill">
          <i />
          <span>
            {dataset.metadata.source_name}
            <small>
              {dataset.stations.length} regional records · snapshot{" "}
              {dataset.metadata.snapshot_id.slice(0, 8)}
            </small>
          </span>
          <button
            className="icon-button"
            aria-label="Dataset source and audit"
            onClick={() => show("data")}
          >
            <Database size={15} />
          </button>
        </div>
        <div className="header-actions">
          {onBack && (
            <button className="quiet" onClick={onBack}>
              ← Station finder
            </button>
          )}
          <button
            className={`viva-toggle ${settings.viva ? "enabled" : ""}`}
            aria-pressed={settings.viva}
            onClick={() => set({ viva: !settings.viva })}
          >
            <BookOpen size={15} /> Viva mode <i />
          </button>
          <button className="quiet" onClick={() => show("scenarios")}>
            <Save size={15} /> Scenarios
          </button>
          <button
            className="quiet report-button"
            onClick={() => report.mutate()}
            disabled={report.isPending}
          >
            <FileText size={15} /> {report.isPending ? "Generating…" : "Report"}
          </button>
        </div>
      </header>
      <nav className="workspace-tabs" aria-label="Analysis workspaces">
        {tabs.map(({ name, icon: Icon }) => (
          <button
            key={name}
            className={settings.tab === name ? "active" : ""}
            aria-current={settings.tab === name ? "page" : undefined}
            onClick={() => set({ tab: name })}
          >
            <Icon size={16} />
            {name}
          </button>
        ))}
      </nav>
      <main className="workspace">
        <aside className="sidebar" ref={sidebarRef}>
          <div className="workspace-intro">
            <div className="eyebrow">{current.kicker}</div>
            <h1>{current.title}</h1>
            <p>{current.description}</p>
          </div>
          <div className="filters">
            <div className="two-col">
              <label className="field">
                <span>State</span>
                <select
                  value={settings.state}
                  onChange={(e) => {
                    set({ state: e.target.value, city: "", comparison: [] });
                    select(null);
                  }}
                >
                  <option value="">All states</option>
                  {states.map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>City</span>
                <select
                  value={settings.city}
                  onChange={(e) => {
                    set({ city: e.target.value, comparison: [] });
                    select(null);
                  }}
                >
                  <option value="">All cities</option>
                  {cities.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </label>
            </div>
            <GraphControls />
          </div>
          {analysis.isPending ? (
            <Loading />
          ) : analysis.error ? (
            <Notice error>{analysis.error.message}</Notice>
          ) : !stations.length ? (
            <Notice>
              No stations match these filters. Clear the state/city filters to
              continue.
            </Notice>
          ) : (
            <>
              {settings.tab === "Trip Planner" && (
                <>
                  <div className="planner-inputs">
                    <EndpointInput
                      label="Origin"
                      point={settings.origin}
                      onChange={(origin) => set({ origin })}
                      stations={stations}
                    />
                    <EndpointInput
                      label="Destination"
                      point={settings.destination}
                      onChange={(destination) => set({ destination })}
                      stations={stations}
                    />
                  </div>
                  <p className="tiny muted">
                    Geocoding is not configured. Enter coordinates or select
                    from your loaded stations. Coordinates snap to the nearest
                    filtered real station.
                  </p>
                  <label className="field">
                    <span>Shortest-path algorithm</span>
                    <select
                      value={settings.algorithm}
                      onChange={(e) =>
                        set({
                          algorithm: e.target.value as "dijkstra" | "astar",
                        })
                      }
                    >
                      <option value="dijkstra">
                        Dijkstra · weighted geographic distance
                      </option>
                      <option value="astar">A* · Haversine heuristic</option>
                    </select>
                  </label>
                  <details className="vehicle-controls" open>
                    <summary>
                      <Zap size={15} /> Vehicle & charging assumptions{" "}
                      <Tag kind="modeled" />
                    </summary>
                    <div className="details-body two-col">
                      {[
                        {
                          key: "capacity_kwh",
                          label: "Battery capacity",
                          unit: "kWh",
                          min: 1,
                          max: 500,
                        },
                        {
                          key: "initial_soc",
                          label: "Initial SOC",
                          unit: "%",
                          min: 0,
                          max: 100,
                        },
                        {
                          key: "consumption_kwh_100km",
                          label: "Consumption",
                          unit: "kWh/100km",
                          min: 1,
                          max: 100,
                        },
                        {
                          key: "reserve_soc",
                          label: "Reserve SOC",
                          unit: "%",
                          min: 0,
                          max: 99,
                        },
                        {
                          key: "target_soc",
                          label: "Target charge SOC",
                          unit: "%",
                          min: 1,
                          max: 100,
                        },
                        {
                          key: "assumed_charge_power_kw",
                          label: "Assumed charge power",
                          unit: "kW",
                          min: 1,
                          max: 1000,
                        },
                        {
                          key: "charge_efficiency",
                          label: "Charge efficiency",
                          unit: "0–1",
                          min: 0.01,
                          max: 1,
                          step: 0.01,
                        },
                        {
                          key: "max_stops",
                          label: "Max charging stops",
                          min: 0,
                          max: 100,
                        },
                      ].map((f) => (
                        <Num
                          key={f.key}
                          label={f.label}
                          value={(settings.vehicle as any)[f.key]}
                          min={f.min}
                          max={f.max}
                          step={f.step || 1}
                          unit={f.unit}
                          onChange={(value) =>
                            set({
                              vehicle: { ...settings.vehicle, [f.key]: value },
                            })
                          }
                        />
                      ))}
                    </div>
                  </details>
                  <Notice>
                    Charge power is your assumption. Source charger power,
                    connector compatibility and charging availability are not
                    inferred.
                  </Notice>
                  <button
                    className="primary full"
                    disabled={
                      !endpointValid(settings.origin) ||
                      !endpointValid(settings.destination) ||
                      route.isPending
                    }
                    onClick={() =>
                      route.mutate({ body: routeBody, key: currentRouteKey })
                    }
                  >
                    <RouteIcon size={16} />{" "}
                    {route.isPending
                      ? "Calculating route…"
                      : "Calculate geographic route"}
                    <ArrowRight size={16} />
                  </button>
                  {route.error && <Notice error>{route.error.message}</Notice>}
                  {routeData && !routeData.found && (
                    <div className="no-path">
                      <GitBranch size={26} />
                      <h3>No network path exists</h3>
                      <p>{routeData.reason}</p>
                      <p className="tiny">
                        {routeData.origin.station_name} →{" "}
                        {routeData.destination.station_name}
                      </p>
                      <p className="tiny">
                        Origin: {format(routeData.origin.latitude, 6)},{" "}
                        {format(routeData.origin.longitude, 6)} → station{" "}
                        {format(routeData.origin.snapped_latitude, 6)},{" "}
                        {format(routeData.origin.snapped_longitude, 6)} · snap{" "}
                        {format(routeData.origin.snap_distance_km, 3)} km
                        <br />
                        Destination: {format(routeData.destination.latitude, 6)}
                        , {format(routeData.destination.longitude, 6)} → station{" "}
                        {format(routeData.destination.snapped_latitude, 6)},{" "}
                        {format(routeData.destination.snapped_longitude, 6)} ·
                        snap {format(routeData.destination.snap_distance_km, 3)}{" "}
                        km
                      </p>
                      <ExportButtons
                        name="no-path"
                        data={routeData}
                        audit={routeData.audit}
                      />
                    </div>
                  )}
                  {routeData?.found && (
                    <>
                      <div className="result-callout">
                        <CheckLabel success={routeData.battery.feasible} />
                        <h3>
                          {format(routeData.distance_km)}{" "}
                          <small>km geographic path</small>
                        </h3>
                        <p>
                          {routeData.path.length} stations ·{" "}
                          {format(routeData.runtime_ms, 3)} ms ·{" "}
                          {settings.algorithm === "astar" ? "A*" : "Dijkstra"}
                        </p>
                        <Tag kind="calculated" />
                      </div>
                      <div className="snap-results">
                        {["origin", "destination"].map((key) => (
                          <div key={key}>
                            <span>{key.toUpperCase()} RESOLUTION</span>
                            <strong>{routeData[key].station_name}</strong>
                            <small>
                              Entered/resolved:{" "}
                              {format(routeData[key].latitude, 6)},{" "}
                              {format(routeData[key].longitude, 6)} · snap{" "}
                              {format(routeData[key].snap_distance_km, 3)} km
                              <br />
                              Snapped station:{" "}
                              {format(routeData[key].snapped_latitude, 6)},{" "}
                              {format(routeData[key].snapped_longitude, 6)}
                            </small>
                          </div>
                        ))}
                      </div>
                      <Notice>{routeData.label}</Notice>
                      <ExportButtons
                        name="trip-route"
                        data={routeData}
                        audit={routeData.audit}
                      />
                    </>
                  )}
                  <Viva>
                    Dijkstra explores the lowest accumulated distance first. A*
                    adds straight-line Haversine distance to the destination;
                    this lower bound is admissible for these geographic edges.
                  </Viva>
                  <Explain title="Geographic trip calculation">
                    Input: filtered imported stations and your graph model. Edge
                    weights: Haversine distance. Measured algorithm runtime
                    excludes battery simulation. Travel time = distance /
                    entered speed × 60. Entered-point connector legs are
                    included in trip totals. A modeled feasible result does not
                    establish a drivable or chargeable trip.
                  </Explain>
                </>
              )}
              {settings.tab === "Infrastructure" && (
                <>
                  <div className="section-title">
                    <h3>Source station records</h3>
                    <Tag kind="observed" />
                  </div>
                  <label className="field">
                    <span>Find a loaded station</span>
                    <div className="search-input">
                      <Search size={14} />
                      <input
                        value={settings.search}
                        onChange={(e) => set({ search: e.target.value })}
                        placeholder="Name, city, state or operator"
                      />
                    </div>
                  </label>
                  <Distribution
                    stations={stations}
                    field="state"
                    title="Stations by state"
                  />
                  <Distribution
                    stations={stations}
                    field="city"
                    title="Stations by city"
                  />
                  <Distribution
                    stations={stations}
                    field="availability"
                    title="Recorded availability"
                  />
                  {dataset.metadata.capabilities.connector_type ? (
                    <Distribution
                      stations={stations}
                      field="connector_type"
                      title="Source connectors"
                    />
                  ) : (
                    <Notice>
                      Connector types: Not provided by current source.
                    </Notice>
                  )}
                  {dataset.metadata.capabilities.num_chargers &&
                  dataset.metadata.capabilities.charging_power_kw ? (
                    <section>
                      <h3>Reported charging capacity</h3>
                      <Tag kind="observed" />
                      <p>
                        {format(
                          stations.reduce(
                            (sum, s) => sum + (s.num_chargers || 0),
                            0,
                          ),
                        )}{" "}
                        reported chargers across{" "}
                        {stations.filter((s) => s.num_chargers !== null).length}{" "}
                        records. Mean reported power{" "}
                        {format(
                          stations
                            .filter((s) => s.charging_power_kw !== null)
                            .reduce((sum, s) => sum + s.charging_power_kw!, 0) /
                            Math.max(
                              1,
                              stations.filter(
                                (s) => s.charging_power_kw !== null,
                              ).length,
                            ),
                        )}{" "}
                        kW. Missing records excluded.
                      </p>
                    </section>
                  ) : (
                    <Notice>
                      Charging capacity analysis: Not provided by current
                      source. Requires reported port count and charging power.
                    </Notice>
                  )}
                  <button
                    className="secondary full"
                    onClick={() => show("data")}
                  >
                    <Database size={15} /> Data quality & source audit
                  </button>
                  <section className="cluster-controls">
                    <h3>Spatial clustering</h3>
                    <p className="muted">
                      DBSCAN on imported station coordinates. Concentration does
                      not imply demand.
                    </p>
                    <div className="two-col">
                      <Num
                        label="Clustering radius"
                        value={settings.clusterRadius}
                        onChange={(clusterRadius) => set({ clusterRadius })}
                        min={0.1}
                        max={500}
                        unit="km"
                      />
                      <Num
                        label="Minimum stations"
                        value={settings.minSamples}
                        onChange={(minSamples) => set({ minSamples })}
                        min={2}
                        max={100}
                      />
                    </div>
                    {cluster.isPending ? (
                      <Loading />
                    ) : cluster.error ? (
                      <Notice error>{cluster.error.message}</Notice>
                    ) : (
                      <p className="tiny">
                        {cluster.data?.clusters.length} geographic clusters ·{" "}
                        {cluster.data?.isolated} noise stations
                      </p>
                    )}
                    <button
                      className="quiet"
                      onClick={() => set({ nodeMetric: "cluster_id" })}
                    >
                      Color map by clusters
                    </button>
                    <Explain title="DBSCAN">
                      Haversine DBSCAN uses the entered distance ε and
                      minimum-sample count. Core neighborhoods form clusters;
                      label −1 means noise, not a station outage. Results use
                      only coordinates.
                    </Explain>
                  </section>
                  <ExportButtons
                    name="filtered-stations"
                    data={stations}
                    audit={audit}
                  />
                  <Viva>
                    Every chart aggregates the currently filtered imported
                    records. The dataset is an extract, not a nationwide census.
                    Data completeness measures reported fields, not station
                    reliability.
                  </Viva>
                </>
              )}
              {settings.tab === "Network Graph" && (
                <>
                  <section>
                    <h3>Graph construction</h3>
                    <p className="muted">
                      {settings.graph.method === "radius"
                        ? `An undirected edge exists only when station separation is ≤ ${settings.graph.radius_km} km.`
                        : `Each station selects ${settings.graph.k} nearest real neighbors; directed selections are combined into an undirected graph.`}{" "}
                      Separate components remain separate.
                    </p>
                    <Tag kind="calculated" />
                  </section>
                  <label className="field">
                    <span>Node metric</span>
                    <select
                      value={settings.nodeMetric}
                      onChange={(e) => set({ nodeMetric: e.target.value })}
                    >
                      {[
                        ["availability", "Source availability"],
                        ["status", "Source status"],
                        ["degree", "Degree"],
                        ["degree_centrality", "Degree centrality"],
                        ["weighted_degree_km", "Weighted degree km"],
                        ["data_completeness_pct", "Data completeness"],
                        ["betweenness_centrality", "Betweenness centrality"],
                        ["closeness_centrality", "Closeness centrality"],
                        ["pagerank", "PageRank"],
                        ["component_id", "Component ID"],
                      ].map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="field">
                    <span>Edge metric (adjacency & table)</span>
                    <select
                      value={settings.edgeMetric}
                      onChange={(e) => set({ edgeMetric: e.target.value })}
                    >
                      <option value="distance_km">
                        Geographic distance · km
                      </option>
                      <option value="estimated_travel_time_min">
                        Modeled travel time · min
                      </option>
                      <option value="route_cost">Route cost · km</option>
                    </select>
                  </label>
                  <label className="field">
                    <span>Highlight on map</span>
                    <select
                      value={settings.highlight}
                      onChange={(e) => set({ highlight: e.target.value })}
                    >
                      <option value="none">All connections</option>
                      <option value="bridges">Bridge edges</option>
                      <option value="articulation">
                        Articulation stations
                      </option>
                    </select>
                  </label>
                  <div className="two-col">
                    <Metric
                      label="Graph density"
                      value={format(summary?.density, 4)}
                    />
                    <Metric
                      label="Bridge edges"
                      value={summary?.bridges.length}
                    />
                    <Metric
                      label="Articulation stations"
                      value={summary?.articulation_points.length}
                    />
                    <Metric
                      label="Isolated stations"
                      value={summary?.isolated}
                    />
                  </div>
                  <div className="health-score">
                    <div>
                      <span>CALCULATED NETWORK HEALTH</span>
                      <strong>
                        {format(summary?.health.score)}
                        <small>/100</small>
                      </strong>
                    </div>
                    <Activity size={30} />
                  </div>
                  <Explain title="Network health formula">
                    40% largest component coverage + 10% raw density + 20%
                    non-isolated share + 20% resilience + 10% proximity.
                    Resilience = 1 − mean(articulation/node share, bridge/edge
                    share). Proximity = max(0, 1 − mean nearest-other-station
                    distance/100 km). Empty/missing proximity contributes zero.
                    This disclosed model is not an official rating.
                  </Explain>
                  <button
                    className="secondary full"
                    onClick={() => show("graph")}
                  >
                    <GitBranch size={16} /> Metrics, edges & adjacency
                  </button>
                  <Viva>
                    A bridge disconnects its component when removed. An
                    articulation node does the same when the node and its
                    incident edges are removed. Weighted degree here sums
                    geographic edge distances; it is not charging capacity.
                  </Viva>
                </>
              )}
              {settings.tab === "Resilience" && (
                <>
                  <Tag kind="modeled">Modeled station outage</Tag>
                  <StationPicker
                    label="Remove station"
                    value={settings.outage}
                    onChange={(outage) => set({ outage })}
                    stations={stations}
                  />
                  <Notice>
                    This removes a node only in a graph copy. Source status is
                    unchanged and no live outage is claimed.
                  </Notice>
                  <button
                    className="primary full"
                    disabled={!settings.outage || outage.isPending}
                    onClick={() =>
                      outage.mutate({
                        body: { ...ctx, station_id: settings.outage },
                        key: contextKey + settings.outage,
                      })
                    }
                  >
                    <Shield size={16} />{" "}
                    {outage.isPending
                      ? "Simulating…"
                      : "Simulate station removal"}
                  </button>
                  {outage.error && (
                    <Notice error>{outage.error.message}</Notice>
                  )}
                  {outageData && (
                    <>
                      <div className="result-callout">
                        <span className="amber-text">SIMULATION COMPLETE</span>
                        <h3>
                          {outageData.disconnected_stations.length}{" "}
                          <small>surviving stations lose reachability</small>
                        </h3>
                        <p>{outageData.station_name}</p>
                      </div>
                      <p className="tiny">
                        Reference station:{" "}
                        {stations.find(
                          (s) => s.station_id === outageData.reference_id,
                        )?.station_name ||
                          outageData.reference_id ||
                          "No surviving reference"}
                      </p>
                      <p className="tiny">
                        Disconnected surviving station IDs:{" "}
                        {outageData.disconnected_stations.join(", ") || "None"}
                      </p>
                      <p className="tiny">
                        Removed node{" "}
                        {outageData.removed_was_articulation
                          ? "was"
                          : "was not"}{" "}
                        an articulation point;{" "}
                        {outageData.removed_incident_bridges.length} incident
                        bridge(s).
                      </p>
                      <ExportButtons
                        name="modeled-outage"
                        data={outageData}
                        audit={outageData.audit}
                      />
                    </>
                  )}
                  <Explain title="Removal impact">
                    Compare connected components, density, bridges, articulation
                    points and the mean weighted distance over reachable
                    unordered station pairs. Reachability uses a surviving
                    reference in the removed station's original component. The
                    removed station itself is excluded from both reachability
                    counts.
                  </Explain>
                  <Viva>
                    Removing an articulation point can split a component.
                    Density may increase after removal even when connectivity
                    worsens because both edge and possible-edge counts change.
                  </Viva>
                </>
              )}
              {settings.tab === "Accessibility" && (
                <>
                  <Tag kind="calculated">Relative index · not official</Tag>
                  <Num
                    label="Nearby-station / gap radius"
                    value={settings.radius}
                    min={0.1}
                    max={500}
                    unit="km"
                    onChange={(radius) => set({ radius })}
                  />
                  <div className="section-title">
                    <h3>Component weights</h3>
                    <span
                      className={weightsValid ? "green-text" : "amber-text"}
                    >
                      {format(
                        Object.values(settings.weights).reduce(
                          (a, b) => a + b,
                          0,
                        ),
                      )}
                      % / 100%
                    </span>
                  </div>
                  {[
                    {
                      key: "distance",
                      label: "Nearest-other-station distance",
                      enabled: stations.length > 1,
                    },
                    {
                      key: "density",
                      label: "Nearby station count",
                      enabled: true,
                    },
                    {
                      key: "connectivity",
                      label: "Graph degree",
                      enabled: true,
                    },
                    {
                      key: "availability",
                      label: "Source-recorded availability",
                      enabled: dataset.metadata.availability_index,
                    },
                    {
                      key: "ports",
                      label: "Reported port count",
                      enabled: dataset.metadata.capabilities.num_chargers,
                    },
                    {
                      key: "power",
                      label: "Reported charging power",
                      enabled: dataset.metadata.capabilities.charging_power_kw,
                    },
                  ].map((component) => (
                    <label
                      className={`weight-control ${component.enabled ? "" : "disabled"}`}
                      key={component.key}
                    >
                      <span>
                        {component.label}
                        <small>
                          {component.enabled
                            ? "Normalized relative to this filter"
                            : "Not provided in usable form by current source"}
                        </small>
                      </span>
                      <input
                        aria-label={`${component.label} weight`}
                        type="number"
                        min={0}
                        max={100}
                        disabled={!component.enabled}
                        value={settings.weights[component.key] || 0}
                        onChange={(e) =>
                          set({
                            weights: {
                              ...settings.weights,
                              [component.key]: Number(e.target.value),
                            },
                          })
                        }
                      />
                      <b>%</b>
                    </label>
                  ))}
                  {!weightsValid && (
                    <Notice>
                      Weights must total exactly 100% before calculating.
                    </Notice>
                  )}
                  {access.isFetching && <Loading />}
                  {access.error && (
                    <Notice error>{access.error.message}</Notice>
                  )}
                  <button
                    className="secondary full"
                    disabled={!weightsValid || !access.data}
                    onClick={() => show("access")}
                  >
                    <Activity size={15} /> Full accessibility ranking
                  </button>
                  <button
                    className="quiet"
                    onClick={() => set({ nodeMetric: "score" })}
                  >
                    Color map by index
                  </button>
                  <Explain title="Relative accessibility formula">
                    100 × Σ(w × normalized input) / Σ(available weights).
                    Distance = 1 − distance/max distance; counts, degree, ports
                    and power = value/max value. Availability is interpreted
                    only for explicit 0/1, true/false or available/unavailable
                    values. Missing row inputs are excluded and weight coverage
                    is shown. Excellent ≥80, Good ≥60, Moderate ≥40, Poor ≥20,
                    Very Poor &lt;20. This ranks station neighborhoods, not
                    population access.
                  </Explain>
                  <div className="gap-explorer">
                    <h3>Geographic gap explorer</h3>
                    <p className="muted">
                      Choose a state/city above. These station neighborhoods
                      have the largest nearest-other-station gaps.
                    </p>
                    <Table
                      rows={[...(access.data?.ranking || [])]
                        .sort(
                          (a: any, b: any) =>
                            (b.nearest_station_km || 0) -
                            (a.nearest_station_km || 0),
                        )
                        .slice(0, 5)}
                      columns={[
                        { key: "station_name", label: "Station area" },
                        { key: "nearest_station_km", label: "Gap km" },
                      ]}
                      onRow={(s) => select(s.station_id)}
                    />
                  </div>
                  <Viva>
                    A relative index can change when the filter changes because
                    normalization maxima change. It cannot establish government
                    coverage or underserved population without additional
                    geographic and population data.
                  </Viva>
                </>
              )}
              {settings.tab === "Expansion" && (
                <>
                  <Tag kind="modeled">Geographic candidate model</Tag>
                  <Num
                    label="Candidate neighborhood radius"
                    value={settings.radius}
                    onChange={(radius) => set({ radius })}
                    min={0.1}
                    max={500}
                    unit="km"
                  />
                  <Notice>
                    Candidates are geographic points, not build-ready sites.
                    Land, roads, traffic, demand and grid capacity are not
                    available.
                  </Notice>
                  {expand.isPending ? (
                    <Loading />
                  ) : expand.error ? (
                    <Notice error>{expand.error.message}</Notice>
                  ) : (
                    <>
                      {!expand.data?.candidates.length ? (
                        <Notice>
                          {expand.data?.reason ||
                            "No distinct geographic gap candidates exist in this filter."}
                        </Notice>
                      ) : (
                        <div className="candidate-list">
                          {expand.data.candidates
                            .slice(0, 5)
                            .map((c: any, i: number) => (
                              <button
                                key={c.candidate_id}
                                onClick={() =>
                                  show(`candidate:${c.candidate_id}`)
                                }
                              >
                                <span className="candidate-rank">
                                  {String(i + 1).padStart(2, "0")}
                                </span>
                                <span>
                                  <strong>
                                    {format(c.latitude, 4)}°N,{" "}
                                    {format(c.longitude, 4)}°E
                                  </strong>
                                  <small>
                                    {format(c.nearest_station_km)} km to nearest
                                    station
                                  </small>
                                </span>
                                <b>{format(c.score)}</b>
                              </button>
                            ))}
                        </div>
                      )}
                      <button
                        className="secondary full"
                        onClick={() => show("expansion")}
                      >
                        <Plus size={15} /> All candidates & addition impact
                      </button>
                      <ExportButtons
                        name="expansion-candidates"
                        data={expand.data?.candidates || []}
                        audit={expand.data?.audit}
                      />
                    </>
                  )}
                  <Explain title="Candidate generation & scoring">
                    Geographic minimum spanning tree edges generate spherical
                    midpoints. Consider the 40 longest positive gap edges and
                    rank the top ten. Score = 35% normalized nearest distance +
                    25% scarcity (1/(1+nearby count)) + 25% component joining +
                    15% normalized pair-gap halving. Simulated additions rebuild
                    the actual configured graph. Pair-gap halving is a geometric
                    proxy, not measured coverage area.
                  </Explain>
                  <Viva>
                    The candidate-generating MST does not alter the real graph.
                    Rebuilding k-NN after adding a candidate can change old
                    neighbor choices, so before/after results reflect those
                    changes too.
                  </Viva>
                </>
              )}
              {settings.tab === "Methodology" && (
                <>
                  <Methodology />
                  <button
                    className="secondary full"
                    onClick={() => show("capabilities")}
                  >
                    <Database size={15} /> Feature capability matrix
                  </button>
                  <button
                    className="secondary full"
                    onClick={() => show("audit")}
                  >
                    <CircleHelp size={15} /> Analysis reproducibility
                  </button>
                  <button
                    className="primary full"
                    onClick={() => report.mutate()}
                    disabled={report.isPending}
                  >
                    <FileText size={15} /> Generate academic HTML report
                  </button>
                  <p className="tiny muted">
                    Report recomputes the current graph, accessibility and
                    candidates, and includes your current route/outage when
                    available. Open the downloaded HTML to print or save as PDF.
                  </p>
                </>
              )}
            </>
          )}
          {report.error && <Notice error>{report.error.message}</Notice>}
          <div className="sidebar-footer">
            <Shield size={14} />
            <span>
              Every result starts with your source.
              <small>
                Snapshot {dataset.metadata.snapshot_id.slice(0, 12)}
              </small>
            </span>
            <button
              className="icon-button"
              aria-label="Show analysis audit"
              onClick={() => show("audit")}
            >
              <CircleHelp size={15} />
            </button>
          </div>
        </aside>
        <section className="map-workspace">
          <MapView
            stations={mapStations}
            edges={analysis.data?.edges || []}
            route={routeData}
            candidates={expand.data?.candidates || []}
            clusters={cluster.data}
          />
          <div className="map-metrics">
            <Metric
              label="Imported stations"
              value={analysis.data ? stations.length : undefined}
              kind="observed"
            />
            <Metric label="Geographic edges" value={summary?.edges} />
            <Metric label="Components" value={summary?.components} />
            <Metric
              label="Largest component"
              value={
                summary
                  ? (summary.largest_component_size / stations.length) * 100
                  : undefined
              }
              unit="%"
            />
          </div>
          {analysis.isFetching && (
            <div className="map-loading">
              <Loading />
            </div>
          )}
          <div className="map-bottom-panel">
            {settings.tab === "Trip Planner" ? (
              routeData?.found ? (
                <RouteSummary
                  result={routeData}
                  onInspect={select}
                  onTimeline={() => show("timeline")}
                />
              ) : (
                <div className="map-empty">
                  <Navigation size={28} />
                  <div>
                    <h3>
                      {routeData
                        ? "A disconnected network is an honest result."
                        : "Your next trip starts with real coordinates."}
                    </h3>
                    <p>
                      {routeData
                        ? "Adjust the proximity model to explore a different graph. No fallback links are added."
                        : "Choose an origin and destination, then calculate a geographic path."}
                    </p>
                  </div>
                  <Tag kind="modeled" />
                </div>
              )
            ) : settings.tab === "Resilience" ? (
              outageData ? (
                <BeforeAfter result={outageData} />
              ) : (
                <div className="map-empty">
                  <Shield size={28} />
                  <div>
                    <h3>How much does one station matter?</h3>
                    <p>
                      Select a real station to compare the network before and
                      after a modeled removal.
                    </p>
                  </div>
                </div>
              )
            ) : settings.tab === "Accessibility" ? (
              <div>
                <div className="section-title">
                  <h3>Relative accessibility · top station neighborhoods</h3>
                  <Tag kind="calculated" />
                  <button className="quiet" onClick={() => show("access")}>
                    View ranking <ArrowRight size={14} />
                  </button>
                </div>
                <Table
                  rows={
                    weightsValid ? (access.data?.ranking || []).slice(0, 4) : []
                  }
                  columns={[
                    { key: "station_name", label: "Station neighborhood" },
                    { key: "score", label: "Index /100" },
                    { key: "classification", label: "Class" },
                    { key: "weight_coverage_pct", label: "Weight coverage %" },
                  ]}
                  onRow={(s) => select(s.station_id)}
                />
              </div>
            ) : settings.tab === "Expansion" ? (
              <div>
                <div className="section-title">
                  <h3>Top geographic gap candidates</h3>
                  <Tag kind="modeled" />
                </div>
                <Table
                  rows={(expand.data?.candidates || []).slice(0, 3)}
                  columns={[
                    { key: "latitude", label: "Latitude" },
                    { key: "longitude", label: "Longitude" },
                    { key: "nearest_station_km", label: "Nearest km" },
                    { key: "score", label: "Score" },
                    {
                      key: "candidate_id",
                      label: "Inspect",
                      render: (c) => (
                        <button
                          className="table-link"
                          onClick={() => show(`candidate:${c.candidate_id}`)}
                        >
                          Addition impact →
                        </button>
                      ),
                    },
                  ]}
                />
              </div>
            ) : settings.tab === "Methodology" ? (
              <div className="map-empty">
                <GitBranch size={30} />
                <div>
                  <h3>G = (V, E)</h3>
                  <p>
                    V: imported real station records. E: user-configured
                    geographic proximity links.
                  </p>
                  <span className="tiny muted">
                    Observed source data → validated immutable snapshot →
                    calculated graph → explainable analysis
                  </span>
                </div>
              </div>
            ) : (
              <div>
                <div className="section-title">
                  <h3>
                    {settings.tab === "Network Graph"
                      ? "Centrality ranking"
                      : "Imported station explorer"}
                  </h3>
                  <Tag
                    kind={
                      settings.tab === "Network Graph"
                        ? "calculated"
                        : "observed"
                    }
                  />
                  <button
                    className="quiet"
                    onClick={() =>
                      show(
                        settings.tab === "Network Graph" ? "graph" : "stations",
                      )
                    }
                  >
                    Explore all <ArrowRight size={14} />
                  </button>
                </div>
                <Table
                  rows={(settings.tab === "Network Graph"
                    ? [...stations].sort(
                        (a, b) =>
                          b.betweenness_centrality - a.betweenness_centrality,
                      )
                    : stations
                  ).slice(0, 4)}
                  columns={
                    settings.tab === "Network Graph"
                      ? [
                          { key: "station_name", label: "Station" },
                          { key: "degree", label: "Degree" },
                          {
                            key: "betweenness_centrality",
                            label: "Betweenness",
                          },
                          { key: "component_id", label: "Component" },
                        ]
                      : stationColumns.slice(0, 4)
                  }
                  onRow={(s) => select(s.station_id)}
                />
              </div>
            )}
          </div>
          {inspected && (
            <StationInspector
              station={inspected}
              adjacency={analysis.data?.adjacency?.[inspected.station_id] || []}
              onClose={() => select(null)}
              onAction={(action) => {
                if (action === "origin" || action === "destination")
                  set({
                    [action]: {
                      ...settings[action],
                      mode: "station",
                      station_id: inspected.station_id,
                    },
                    tab: "Trip Planner",
                  });
                if (action === "outage")
                  set({ outage: inspected.station_id, tab: "Resilience" });
                select(null);
              }}
            />
          )}
        </section>
      </main>
      <footer className="statusbar">
        <span>
          <i /> LOCAL SNAPSHOT ·{" "}
          {new Date(dataset.metadata.imported_at).toLocaleString("en-IN", {
            timeZone: "Asia/Kolkata",
          })}
        </span>
        <span>
          {settings.graph.method === "radius"
            ? `${settings.graph.radius_km} km radius`
            : `k = ${settings.graph.k}`}{" "}
          · Haversine · {settings.graph.speed_kmh} km/h assumed
        </span>
        <span>NO LIVE OCCUPANCY CLAIMS</span>
      </footer>
      {panel && (
        <Modal
          title={
            panel.startsWith("candidate:")
              ? "Candidate addition simulation"
              : (
                  {
                    data: "Dataset source & quality",
                    audit: "Analysis reproducibility",
                    scenarios: "Local scenarios",
                    capabilities: "Feature capability matrix",
                    stations: "Observed station records",
                    graph: "Graph metrics & adjacency",
                    access: "Relative accessibility ranking",
                    expansion: "Geographic expansion candidates",
                    comparison: "Station comparison",
                    timeline: "Modeled charging stop timeline",
                  } as any
                )[panel] || panel
          }
          onClose={() => show(null)}
        >
          {panel === "data" && (
            <>
              <Tag kind="observed" />
              <div className="source-details">
                <h3>{dataset.metadata.source_name}</h3>
                <a
                  href={
                    /^https?:\/\//.test(dataset.metadata.source_url || "")
                      ? dataset.metadata.source_url
                      : undefined
                  }
                  target="_blank"
                  rel="noreferrer"
                >
                  {dataset.metadata.source_url || "No source URL supplied"}
                </a>
                <p>
                  Imported{" "}
                  {new Date(dataset.metadata.imported_at).toLocaleString(
                    "en-IN",
                    { timeZone: "Asia/Kolkata" },
                  )}
                </p>
              </div>
              <div className="audit-counts">
                {[
                  ["raw_records", "Raw"],
                  ["valid_records", "Valid"],
                  ["rejected_records", "Rejected"],
                  ["duplicate_ids_removed", "Duplicate IDs"],
                ].map(([key, label]) => (
                  <div key={key}>
                    <strong>{dataset.metadata[key]}</strong>
                    <span>{label}</span>
                  </div>
                ))}
              </div>
              <Table
                rows={Object.entries(dataset.metadata.missing_fields).map(
                  ([field, count]) => ({
                    field,
                    missing: count,
                    available: dataset.metadata.capabilities[field]
                      ? "At least one record"
                      : "Not provided by current source",
                  }),
                )}
                columns={[
                  { key: "field", label: "Standard field" },
                  { key: "missing", label: "Missing records" },
                  { key: "available", label: "Capability" },
                ]}
              />
              <Table
                rows={[
                  ...dataset.metadata.rejections,
                  ...dataset.metadata.duplicates,
                  ...dataset.metadata.warnings,
                ]}
                columns={[
                  { key: "row", label: "Source row" },
                  { key: "reason", label: "Validation reason" },
                ]}
              />
              <Notice>
                {dataset.metadata.coordinate_validation}{" "}
                {dataset.metadata.limitations}
              </Notice>
              <ExportButtons
                name="data-quality-audit"
                data={dataset.metadata}
                audit={dataset.metadata}
              />
              <button
                className="secondary danger"
                onClick={() => unload.mutate()}
                disabled={unload.isPending}
              >
                <Database size={15} /> Unload active dataset & import another
              </button>
              <p className="tiny muted">
                Saved snapshots and scenarios are retained locally. The
                onboarding screen will open.
              </p>
            </>
          )}
          {panel === "audit" && (
            <>
              <Tag kind="calculated" />
              <p>
                The active snapshot, raw SHA-256, filter settings and model
                assumptions travel with every analysis export. Save a named
                scenario to restore settings and the same snapshot after
                reopening.
              </p>
              <pre>
                {JSON.stringify(
                  {
                    ...audit,
                    vehicle: settings.vehicle,
                    accessibility: {
                      weights: settings.weights,
                      radius_km: settings.radius,
                    },
                    route: {
                      origin: settings.origin,
                      destination: settings.destination,
                      algorithm: settings.algorithm,
                    },
                    modeled_outage: settings.outage || null,
                  },
                  null,
                  2,
                )}
              </pre>
              <ExportButtons
                name="reproducibility"
                data={settings}
                audit={audit}
              />
            </>
          )}
          {panel === "capabilities" && (
            <Capabilities
              metadata={dataset.metadata}
              providers={providers.data}
            />
          )}
          {panel === "scenarios" && (
            <>
              <p>
                Scenarios preserve the immutable dataset snapshot plus filters,
                graph settings, accessibility weights, vehicle assumptions,
                selected route, and modeled outage.
              </p>
              <div className="scenario-form">
                <label className="field">
                  <span>Scenario name</span>
                  <input
                    value={settings.scenarioName}
                    onChange={(e) => set({ scenarioName: e.target.value })}
                    placeholder="Name this analysis"
                    maxLength={100}
                  />
                </label>
                <button
                  className="primary"
                  disabled={
                    !settings.scenarioName.trim() || saveScenario.isPending
                  }
                  onClick={() =>
                    saveScenario.mutate({
                      name: settings.scenarioName.trim(),
                      values: settings,
                    })
                  }
                >
                  <Save size={15} /> Save
                </button>
              </div>
              {saveScenario.error && (
                <Notice error>{saveScenario.error.message}</Notice>
              )}
              {loadScenario.error && (
                <Notice error>{loadScenario.error.message}</Notice>
              )}
              {deleteScenario.error && (
                <Notice error>{deleteScenario.error.message}</Notice>
              )}
              {scenarios.isPending ? (
                <Loading />
              ) : scenarios.error ? (
                <Notice error>{scenarios.error.message}</Notice>
              ) : !scenarios.data?.length ? (
                <Notice>
                  No saved scenarios yet. Save the current analysis to make it
                  reproducible.
                </Notice>
              ) : (
                scenarios.data.map((s: any) => (
                  <div className="scenario-row" key={s.id}>
                    <div>
                      <strong>{s.name}</strong>
                      <small>
                        Snapshot {s.snapshot_id.slice(0, 12)} ·{" "}
                        {new Date(s.created_at).toLocaleDateString("en-IN")}
                      </small>
                    </div>
                    <button
                      className="quiet"
                      onClick={() => loadScenario.mutate(s.id)}
                    >
                      Load
                    </button>
                    <button
                      className="quiet"
                      onClick={() =>
                        saveScenario.mutate({
                          name: `${s.name} copy`,
                          values: s.settings,
                        })
                      }
                    >
                      Duplicate
                    </button>
                    <button
                      className="icon-button"
                      aria-label={`Export ${s.name}`}
                      onClick={() =>
                        exportData(`scenario-${s.id}`, s, s, "json")
                      }
                    >
                      <Download size={15} />
                    </button>
                    <button
                      className="icon-button"
                      aria-label={`Delete ${s.name}`}
                      onClick={() => deleteScenario.mutate(s.id)}
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                ))
              )}
              <button
                className="secondary"
                onClick={() => {
                  reset();
                  show(null);
                }}
              >
                Reset workspace settings
              </button>
            </>
          )}
          {panel === "stations" && (
            <>
              <Tag kind="observed" />
              <p>Select 2–4 real stations for a calculated comparison.</p>
              <Table
                rows={stations}
                columns={[
                  {
                    key: "select",
                    label: "Compare",
                    render: (s) => (
                      <input
                        aria-label={`Compare ${s.station_name}`}
                        type="checkbox"
                        checked={settings.comparison.includes(s.station_id)}
                        disabled={
                          !settings.comparison.includes(s.station_id) &&
                          settings.comparison.length >= 4
                        }
                        onChange={() =>
                          set({
                            comparison: settings.comparison.includes(
                              s.station_id,
                            )
                              ? settings.comparison.filter(
                                  (id) => id !== s.station_id,
                                )
                              : [...settings.comparison, s.station_id],
                          })
                        }
                      />
                    ),
                  },
                  ...stationColumns,
                ]}
                onRow={(s) => {
                  show(null);
                  select(s.station_id);
                }}
              />
              <button
                className="primary"
                disabled={!canCompare || comparison.isPending}
                onClick={() =>
                  comparison.mutate({
                    body: { ...ctx, station_ids: settings.comparison },
                    key: contextKey + JSON.stringify(settings.comparison),
                  })
                }
              >
                Compare {settings.comparison.length} stations
              </button>
              {comparison.error && (
                <Notice error>{comparison.error.message}</Notice>
              )}
              <ExportButtons
                name="filtered-stations"
                data={stations}
                audit={audit}
              />
            </>
          )}
          {panel === "comparison" && (
            <>
              {compareData ? (
                <>
                  <Tag kind="calculated" />
                  <Table
                    rows={compareData.stations}
                    columns={[
                      ...stationColumns,
                      { key: "latitude", label: "Latitude" },
                      { key: "longitude", label: "Longitude" },
                      { key: "nearby_station_count", label: "Nearby /25km" },
                      { key: "nearest_station_km", label: "Nearest km" },
                      { key: "component_id", label: "Component" },
                      { key: "degree_centrality", label: "Degree centrality" },
                      { key: "betweenness_centrality", label: "Betweenness" },
                      { key: "closeness_centrality", label: "Closeness" },
                      {
                        key: "disconnected_on_removal",
                        label: "Lost reachability on removal",
                      },
                    ]}
                  />
                  <ExportButtons
                    name="station-comparison"
                    data={compareData.stations}
                    audit={compareData.audit}
                  />
                </>
              ) : (
                <Notice>
                  Comparison inputs changed. Select stations and compare again.
                </Notice>
              )}
            </>
          )}
          {panel === "graph" && (
            <>
              <Tag kind="calculated" />
              <p>
                Exact centralities. Degree sums incident edges; weighted degree
                sums distances in km. Co-located nodes retain zero routing
                distances; centralities use a disclosed 10⁻⁹ km epsilon.
                PageRank weights affinity 1/(1+distance).
              </p>
              <Table
                rows={stations}
                columns={[
                  { key: "station_name", label: "Station" },
                  { key: "degree", label: "Degree" },
                  { key: "weighted_degree_km", label: "Weighted degree km" },
                  { key: "degree_centrality", label: "Degree centrality" },
                  { key: "betweenness_centrality", label: "Betweenness" },
                  { key: "closeness_centrality", label: "Closeness" },
                  { key: "pagerank", label: "PageRank" },
                  { key: "component_id", label: "Component" },
                  { key: "articulation", label: "Articulation" },
                ]}
                onRow={(s) => {
                  show(null);
                  select(s.station_id);
                }}
              />
              <h3>Edge list · {settings.edgeMetric}</h3>
              <Table
                rows={analysis.data?.edges || []}
                columns={[
                  { key: "source", label: "Source ID" },
                  { key: "target", label: "Target ID" },
                  { key: settings.edgeMetric, label: settings.edgeMetric },
                  { key: "bridge", label: "Bridge" },
                ]}
              />
              <details>
                <summary>Full adjacency list</summary>
                <pre>{JSON.stringify(analysis.data?.adjacency, null, 2)}</pre>
              </details>
              <ExportButtons
                name="graph-analysis"
                data={analysis.data}
                audit={audit}
              />
            </>
          )}
          {panel === "access" && (
            <>
              {access.data && weightsValid ? (
                <>
                  <Tag kind="calculated" />
                  <p>{access.data.formula}</p>
                  <Table
                    rows={access.data.ranking}
                    columns={[
                      { key: "station_name", label: "Station neighborhood" },
                      { key: "city", label: "City" },
                      { key: "score", label: "Index" },
                      { key: "classification", label: "Class" },
                      { key: "nearest_station_km", label: "Nearest km" },
                      { key: "nearby_station_count", label: "Nearby count" },
                      {
                        key: "weight_coverage_pct",
                        label: "Available weight %",
                      },
                      {
                        key: "inputs",
                        label: "Normalized inputs",
                        render: (s) => <code>{JSON.stringify(s.inputs)}</code>,
                      },
                    ]}
                    onRow={(s) => {
                      show(null);
                      select(s.station_id);
                    }}
                  />
                  <ExportButtons
                    name="accessibility-ranking"
                    data={access.data.ranking}
                    audit={access.data.audit}
                  />
                </>
              ) : (
                <Notice>
                  Set valid weights on the Accessibility workspace to calculate
                  a ranking.
                </Notice>
              )}
            </>
          )}
          {panel === "expansion" && (
            <>
              <Tag kind="modeled" />
              <p>{expand.data?.method}</p>
              <Table
                rows={expand.data?.candidates || []}
                columns={[
                  { key: "latitude", label: "Latitude" },
                  { key: "longitude", label: "Longitude" },
                  { key: "nearest_station_km", label: "Nearest km" },
                  { key: "nearby_station_count", label: "Nearby" },
                  { key: "score", label: "Score" },
                  { key: "reason", label: "Reason" },
                  {
                    key: "inspect",
                    label: "Addition",
                    render: (c) => (
                      <button
                        className="table-link"
                        onClick={() => show(`candidate:${c.candidate_id}`)}
                      >
                        View impact
                      </button>
                    ),
                  },
                ]}
              />
              <ExportButtons
                name="expansion-candidates"
                data={expand.data?.candidates || []}
                audit={expand.data?.audit}
              />
            </>
          )}
          {panel.startsWith("candidate:") &&
            (() => {
              const c = expand.data?.candidates.find(
                (candidate: any) =>
                  candidate.candidate_id === panel.split(":")[1],
              );
              return c ? (
                <>
                  <Tag kind="modeled" />
                  <h3>
                    {format(c.latitude, 6)}°N, {format(c.longitude, 6)}°E
                  </h3>
                  <p>{c.reason}</p>
                  <BeforeAfter result={c} />
                  <h3>Score inputs</h3>
                  <pre>{JSON.stringify(c.score_inputs, null, 2)}</pre>
                  <Notice>
                    Pair-gap improvement: {format(c.gap_improvement_km)} km.
                    This is a midpoint geometry proxy. No land, road, grid,
                    demand or area-coverage assessment.
                  </Notice>
                  <ExportButtons
                    name="candidate-addition"
                    data={c}
                    audit={expand.data.audit}
                  />
                </>
              ) : (
                <Notice>
                  Candidate no longer exists under the current filter.
                </Notice>
              );
            })()}
          {panel === "timeline" && (
            <>
              {routeData?.found ? (
                <>
                  <Tag kind="modeled" />
                  <Notice>{routeData.battery.label}</Notice>
                  <div className="timeline">
                    {routeData.battery.timeline.map((event: any, i: number) => (
                      <div key={i}>
                        <i
                          className={
                            event.event === "modeled charge" ? "charge" : ""
                          }
                        />
                        <span className="tiny">
                          {String(i + 1).padStart(2, "0")} /{" "}
                          {event.event.toUpperCase()}
                        </span>
                        <strong>
                          {stations.find(
                            (s) => s.station_id === event.station_id,
                          )?.station_name || event.station_id}
                        </strong>
                        <p>
                          SOC {format(event.soc_pct)}% ·{" "}
                          {format(event.energy_kwh, 2)} kWh{" "}
                          {event.event === "travel" ? "consumed" : "added"}{" "}
                          {event.distance_km
                            ? `· ${format(event.distance_km)} km`
                            : ""}{" "}
                          {event.charge_time_min
                            ? `· ${format(event.charge_time_min)} min modeled charging`
                            : ""}
                        </p>
                      </div>
                    ))}
                  </div>
                  {routeData.battery.reason && (
                    <Notice error>{routeData.battery.reason}</Notice>
                  )}
                  <h3>Geographic edge distances</h3>
                  <Table
                    rows={routeData.legs}
                    columns={[
                      { key: "source", label: "From" },
                      { key: "target", label: "To" },
                      { key: "distance_km", label: "km" },
                      {
                        key: "estimated_travel_time_min",
                        label: "Assumed minutes",
                      },
                    ]}
                  />
                  <ExportButtons
                    name="charging-timeline"
                    data={routeData.battery.timeline}
                    audit={routeData.audit}
                  />
                  <ExportButtons
                    name="route-legs"
                    data={routeData.legs}
                    audit={routeData.audit}
                  />
                </>
              ) : (
                <Notice>Calculate a current route first.</Notice>
              )}
            </>
          )}
        </Modal>
      )}
    </div>
  );
}
function CheckLabel({ success }: { success: boolean }) {
  return (
    <span className={success ? "green-text" : "amber-text"}>
      {success
        ? "● FEASIBLE UNDER ENTERED ASSUMPTIONS"
        : "▲ NOT FEASIBLE UNDER ENTERED ASSUMPTIONS"}
    </span>
  );
}
function RouteSummary({
  result,
  onInspect,
  onTimeline,
}: {
  result: any;
  onInspect: (id: string) => void;
  onTimeline: () => void;
}) {
  return (
    <>
      <div className="section-title">
        <h3>
          <RouteIcon size={16} /> Geographic route result
        </h3>
        <Tag kind="calculated" />
        <button className="quiet" onClick={onTimeline}>
          Charging timeline <ArrowRight size={14} />
        </button>
      </div>
      <div className="route-stats">
        <div>
          <span>Geographic distance</span>
          <strong>
            {format(result.distance_km)} <small>km</small>
          </strong>
        </div>
        <div>
          <span>Travel @ entered speed</span>
          <strong>
            {format(result.estimated_travel_time_min)}{" "}
            <small>min modeled</small>
          </strong>
        </div>
        <div>
          <span>Charging estimate</span>
          <strong>
            {format(result.battery.charging_time_min)} <small>min</small>
          </strong>
        </div>
        <div>
          <span>Final modeled SOC</span>
          <strong>
            {format(result.battery.final_soc_pct)} <small>%</small>
          </strong>
        </div>
        <div>
          <span>Topological route risk</span>
          <strong
            className={
              result.risk.classification === "High"
                ? "amber-text"
                : "green-text"
            }
          >
            {result.risk.classification}
          </strong>
        </div>
      </div>
      <div className="route-sequence">
        {result.stations.map((s: Station, i: number) => (
          <span key={s.station_id}>
            <button onClick={() => onInspect(s.station_id)}>
              {i + 1}. {s.station_name}
            </button>
            {i < result.stations.length - 1 && <ArrowRight size={13} />}
          </span>
        ))}
      </div>
      <div className="tiny muted">
        {result.risk.route_station_count} stations · largest gap{" "}
        {format(result.risk.largest_gap_km)} km · average edge{" "}
        {format(result.risk.average_edge_km)} km ·{" "}
        {result.risk.articulation_points.length} articulation nodes ·{" "}
        {result.risk.bridge_edges.length} bridges · alternate paths{" "}
        {result.risk.alternate_local_path_available === null
          ? "N/A"
          : result.risk.alternate_local_path_available
            ? "available"
            : "not available on all legs"}{" "}
        · component {result.risk.component_size} stations
      </div>
      {result.road_route && (
        <p className="tiny">
          Configured OSRM road response: {format(result.road_route.distance_km)}{" "}
          km · {format(result.road_route.duration_min)} min provider estimate.
          Geographic graph totals and battery model remain separate; this is not
          live traffic or turn-by-turn navigation.
        </p>
      )}
      {result.road_error && <Notice error>{result.road_error}</Notice>}
      <Explain title="Route risk & battery estimates">
        {result.risk.formula} Battery consumes distance × entered kWh/100 km. If
        reserve would be breached, a modeled charge fills to target SOC at the
        leg's source station, subject to max stops and target range. Charging
        minutes = battery energy added / (entered kW × efficiency) × 60.{" "}
        {result.battery.energy_consumed_kwh.toFixed(2)} kWh consumed,{" "}
        {result.battery.charging_energy_kwh.toFixed(2)} kWh added,{" "}
        {result.battery.grid_energy_kwh.toFixed(2)} kWh from modeled grid.{" "}
        {result.battery.reason || ""}
      </Explain>
    </>
  );
}
function BeforeAfter({ result }: { result: any }) {
  const keys = [
    ["nodes", "Stations"],
    ["components", "Components"],
    ["density", "Density"],
    ["largest_component_size", "Largest component"],
    ["reachable_stations", "Reachable surviving stations"],
    ["average_within_component_path_km", "Average reachable path (km)"],
  ];
  return (
    <>
      <div className="section-title">
        <h3>Network impact · before / after</h3>
        <Tag kind="modeled" />
      </div>
      <div className="before-after">
        <div className="comparison-heading">
          <span>GRAPH METRIC</span>
          <span>BEFORE</span>
          <span>AFTER</span>
        </div>
        {keys
          .filter(([key]) => key in result.before)
          .map(([key, label]) => (
            <div key={key}>
              <span>{label}</span>
              <strong>{format(result.before[key], 3)}</strong>
              <strong
                className={
                  result.before[key] !== result.after[key] ? "amber-text" : ""
                }
              >
                {format(result.after[key], 3)}
              </strong>
            </div>
          ))}
      </div>
      <p className="tiny muted">
        Bridges {result.before.bridges.length} → {result.after.bridges.length} ·
        articulation nodes {result.before.articulation_points.length} →{" "}
        {result.after.articulation_points.length}
      </p>
    </>
  );
}
function StationInspector({
  station,
  adjacency,
  onClose,
  onAction,
}: {
  station: Station;
  adjacency: any[];
  onClose: () => void;
  onAction: (action: "origin" | "destination" | "outage") => void;
}) {
  return (
    <aside className="inspector">
      <header>
        <Tag kind="observed" />
        <button
          className="icon-button"
          aria-label="Close station inspector"
          onClick={onClose}
        >
          <X size={18} />
        </button>
      </header>
      <div className="inspector-title">
        <MapPin size={22} />
        <h2>{station.station_name}</h2>
        <p>
          {station.city || "City not provided"} ·{" "}
          {station.state || "State not provided"}
        </p>
      </div>
      <div className="confidence">
        <span>
          Source data completeness{" "}
          <b>{format(station.data_completeness_pct)}%</b>
        </span>
        <div>
          <i style={{ width: `${station.data_completeness_pct}%` }} />
        </div>
        <small>Reported fields, not station quality or reliability.</small>
      </div>
      <dl>
        {[
          "station_id",
          "latitude",
          "longitude",
          "city",
          "state",
          "country",
          "operator",
          "status",
          "availability",
          "connector_type",
          "num_chargers",
          "charging_power_kw",
          "degree",
          "weighted_degree_km",
          "component_id",
          "component_size",
          "degree_centrality",
          "betweenness_centrality",
          "closeness_centrality",
          "pagerank",
          "source_row",
        ].map((key) => (
          <div key={key}>
            <dt>{key.replaceAll("_", " ")}</dt>
            <dd>
              {station[key] === null || station[key] === undefined
                ? "Not provided by current source"
                : typeof station[key] === "number"
                  ? format(station[key], 6)
                  : String(station[key])}
            </dd>
          </div>
        ))}
      </dl>
      <h3>Neighbors ({adjacency.length})</h3>
      <Table
        rows={adjacency}
        columns={[
          { key: "station_id", label: "Source ID" },
          { key: "distance_km", label: "km" },
        ]}
      />
      <div className="inspector-actions">
        <button className="primary" onClick={() => onAction("origin")}>
          Set as start
        </button>
        <button className="secondary" onClick={() => onAction("destination")}>
          Set as destination
        </button>
        <button className="secondary" onClick={() => onAction("outage")}>
          Simulate removal
        </button>
      </div>
    </aside>
  );
}
function Capabilities({
  metadata,
  providers,
}: {
  metadata: any;
  providers: any;
}) {
  const rows = [
    {
      feature: "Geographic map & graph routing",
      fields: "ID, name, latitude, longitude",
      enabled: true,
    },
    {
      feature: "Source availability distribution",
      fields: "availability",
      enabled: metadata.capabilities.availability,
    },
    {
      feature: "Availability index component",
      fields: "recognized availability encoding",
      enabled: metadata.availability_index,
    },
    {
      feature: "Connector analysis",
      fields: "connector_type",
      enabled: metadata.capabilities.connector_type,
    },
    {
      feature: "Charging capacity analysis",
      fields: "num_chargers AND charging_power_kw",
      enabled:
        metadata.capabilities.num_chargers &&
        metadata.capabilities.charging_power_kw,
    },
    {
      feature: "Ports index component",
      fields: "num_chargers",
      enabled: metadata.capabilities.num_chargers,
    },
    {
      feature: "Power index component",
      fields: "charging_power_kw",
      enabled: metadata.capabilities.charging_power_kw,
    },
    {
      feature: "Source status coloring",
      fields: "status",
      enabled: metadata.capabilities.status,
    },
    {
      feature: "Battery simulation with user inputs",
      fields: "geographic route + explicit vehicle assumptions",
      enabled: true,
    },
    {
      feature: "Provider road distance / time",
      fields: "configured OSRM provider",
      enabled: Boolean(providers?.academic_road_provider),
    },
    {
      feature: "Geocoding",
      fields: "configured geocoding provider",
      enabled: Boolean(providers?.geocoding_provider),
    },
    {
      feature: "Demand, traffic or live occupancy analysis",
      fields: "verified corresponding observations",
      enabled: false,
    },
  ].map((r) => ({
    ...r,
    state: r.enabled ? "Enabled" : "Disabled",
    reason: r.enabled
      ? "Calculated/source fields available; per-record nulls disclosed"
      : "Not provided by current source or provider configuration",
  }));
  return (
    <>
      <Notice>
        “Available” means at least one source record has the field. Missing
        record values remain null.
      </Notice>
      <Table
        rows={rows}
        columns={[
          { key: "feature", label: "Feature" },
          { key: "fields", label: "Required inputs" },
          { key: "state", label: "State" },
          { key: "reason", label: "Reason" },
        ]}
      />
    </>
  );
}
function Methodology() {
  return (
    <div className="methodology">
      <Tag kind="calculated" />
      {[
        [
          "G = (V, E)",
          "V contains validated imported station records. E contains undirected geographic proximity links. Edge attributes: Haversine distance_km, distance / entered speed × 60 estimated_travel_time_min, and route_cost equal to distance.",
        ],
        [
          "Haversine distance",
          "d = 2R asin(√[sin²(Δφ/2) + cos φ₁ cos φ₂ sin²(Δλ/2)]), R = 6371.0088 km. Latitude and longitude are converted to radians. Geographic distance is not road distance.",
        ],
        [
          "Radius vs k-NN",
          "Radius joins stations within a user-entered geographic separation. k-NN forms the undirected union of each node’s k closest other nodes. No fallback edges, corridors or forced connected components.",
        ],
        [
          "Dijkstra vs A*",
          "Dijkstra minimizes accumulated edge weights. A* minimizes g(n)+h(n) using Haversine to the target as an admissible lower bound. Both compute paths over the same graph. Runtime is measured with perf_counter. A no-path result is preserved.",
        ],
        [
          "Centrality",
          "Degree centrality = degree/(n−1). Betweenness sums fractions of shortest paths through a node. Closeness uses weighted distances with NetworkX’s component correction. PageRank uses affinity 1/(1+distance). Exact calculations are bounded to 1,000 input records. Co-located zero-length links use 10⁻⁹ km only for centralities.",
        ],
        [
          "Components, bridges & articulation",
          "A component is a maximal mutually reachable node set. A bridge edge or articulation node disconnects its component when removed. These are geographic model properties, not observed road or electrical dependencies.",
        ],
        [
          "Accessibility",
          "Relative station-neighborhood score = 100 × Σ(weight × normalized available input) / Σ(available weights). Weights total 100%; unavailable components are disabled. Record missingness and available weight coverage are disclosed. Classification thresholds are 80, 60, 40, and 20.",
        ],
        [
          "Candidate sites",
          "Geographic MST gap edges produce deterministic spherical midpoints. Rank a bounded pool using nearest distance, nearby density, component joining and pair-gap halving. Actual graph addition is simulated by rebuilding the current graph. Sites require land, water, road and grid screening before any planning use.",
        ],
        [
          "Battery & route risk",
          "User-entered capacity, SOC, reserve, consumption, target, power, efficiency and stops control a sequential energy balance. No observed charger power is replaced by an assumed observation. Topological risk is High for bridges, Moderate for articulation nodes or >50km legs, else Low; it is not driving safety.",
        ],
        [
          "Source integrity & limitations",
          "Import rejects missing IDs/names, invalid coordinates, outside-envelope locations and explicit non-India country values. First valid duplicate ID wins; same-coordinate distinct IDs remain. Missing fields stay null. Envelope checks are not border or ground verification. Availability is source-recorded and may be stale. This is not a national census, official score, live monitoring, demand model or charging guarantee.",
        ],
      ].map(([title, text]) => (
        <details key={title} open={title === "G = (V, E)"}>
          <summary>{title}</summary>
          <p>{text}</p>
        </details>
      ))}
      <p className="tiny">
        <a
          href="https://networkx.org/documentation/stable/"
          target="_blank"
          rel="noreferrer"
        >
          NetworkX algorithm documentation ↗
        </a>{" "}
        ·{" "}
        <a
          href="https://www.naturalearthdata.com/"
          target="_blank"
          rel="noreferrer"
        >
          Natural Earth basemap ↗
        </a>
      </p>
    </div>
  );
}
