import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowDownUp,
  ArrowRight,
  ChevronDown,
  CircleHelp,
  Compass,
  Database,
  MapPin,
  Navigation,
  Search,
  Settings2,
  X,
  Zap,
} from "lucide-react";
import type { Dataset, Station } from "./types";
import { defaultSettings, useUI } from "./store";
import { exportData, format, request } from "./api";
import { findStations, REGIONS } from "./finder";
import { Modal, Notice, Num } from "./shared";
import MapView from "./MapView";
import EndpointChoice from "./EndpointChoice";
import {
  journeyEndpointsValid,
  pointCoordinates,
  type TripPoint,
} from "./tripPoints";
import "./finder.css";

export default function StationFinder({
  dataset,
  onResearch,
}: {
  dataset: Dataset;
  onResearch: () => void;
}) {
  const sidebar = useRef<HTMLElement>(null);
  const [mode, setMode] = useState<"find" | "trip">("find");
  useEffect(() => {
    sidebar.current?.scrollTo({ top: 0 });
  }, [mode]);
  const [search, setSearch] = useState("");
  const [state, setState] = useState("");
  const [origin, setOrigin] = useState<TripPoint | null>(null);
  const [destination, setDestination] = useState<TripPoint | null>(null);
  const [pickOnMap, setPickOnMap] = useState<"origin" | "destination" | null>(
    null,
  );
  const [tripReset, setTripReset] = useState(0);
  const providers = useQuery({
    queryKey: ["providers"],
    queryFn: () => request("health"),
    staleTime: 60000,
  });
  const [vehicle, setVehicle] = useState({ ...defaultSettings.vehicle });
  const [powerOptions, setPowerOptions] = useState(false);
  const [panel, setPanel] = useState<"source" | "tools" | "help" | null>(null);
  const selected = useUI((s) => s.selected),
    select = useUI((s) => s.select);
  const qc = useQueryClient();
  useEffect(() => {
    select(null);
  }, [select]);
  const stations = useMemo(
    () => findStations(dataset.stations, state, search),
    [dataset.stations, state, search],
  );
  const station = stations.find((s) => s.station_id === selected);
  const [shown, setShown] = useState(12);
  const filterKey = `${state}|${search}`;
  useEffect(() => {
    setShown(12);
    select(null);
  }, [filterKey, select]);
  const graph = defaultSettings.graph;
  const routeBody = {
    graph,
    origin: origin ? { ...origin.point, label: origin.label } : {},
    destination: destination
      ? { ...destination.point, label: destination.label }
      : {},
    vehicle,
  };
  const routeKey = JSON.stringify({
    body: routeBody,
    snapshot: dataset.metadata.snapshot_id,
  });
  const unload = useMutation({
    mutationFn: () => request("dataset", undefined, "DELETE"),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["dataset"] }),
  });
  const route = useMutation({
    mutationFn: async ({
      body,
      key,
    }: {
      body: typeof routeBody;
      key: string;
    }) => ({ result: await request("trip", body), key }),
  });
  const result = route.data?.key === routeKey ? route.data.result : null;
  const explain = useMutation({
    mutationFn: async () => ({
      key: routeKey,
      explanation: await request("trip/explain", routeBody),
    }),
  });
  const enteredPoints = [origin, destination].flatMap((p, i) => {
    const coords = pointCoordinates(p, dataset.stations);
    return coords ? [{ ...coords, label: i === 0 ? "A" : "B" }] : [];
  });
  const clearTrip = () => {
    setOrigin(null);
    setDestination(null);
    setTripReset(tripReset + 1);
    setPickOnMap(null);
    explain.reset();
    route.reset();
    select(null);
  };
  const counts = dataset.metadata.regional_counts || {};
  const pickTrip = (s: Station, as: "origin" | "destination") => {
    setMode("trip");
    (as === "origin" ? setOrigin : setDestination)({
      label: s.station_name,
      source: "station",
      point: { station_id: s.station_id },
    });
    select(null);
  };
  return (
    <div className="finder">
      <header className="finder-header">
        <a
          className="finder-brand"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            setMode("find");
          }}
          aria-label="EV Network station finder"
        >
          <span className="finder-brand-icon">
            <Zap size={23} />
          </span>
          <span>
            ev<span className="brand-dot">.</span> network
            <small>CHARGE YOUR NEXT JOURNEY</small>
          </span>
        </a>
        <span className="finder-region-note">
          UP · Delhi · Rajasthan · Haryana · Punjab · MP
        </span>
        <div className="finder-header-actions">
          <button onClick={() => setPanel("source")}>
            <Database size={15} />
            <span>Our data</span>
          </button>
          <button onClick={() => setPanel("tools")}>
            <Settings2 size={15} />
            <span>Project tools</span>
          </button>
        </div>
      </header>
      <main className="finder-layout">
        <aside
          ref={sidebar}
          className="finder-sidebar"
          aria-label="Station search and trip planner"
        >
          <div className="finder-intro">
            <span className="finder-eyebrow">
              <i /> LET’S KEEP YOU MOVING
            </span>
            <h1>
              {mode === "find" ? (
                <>
                  Find your next
                  <br />
                  <em>charging stop.</em>
                </>
              ) : (
                <>
                  Plan your
                  <br />
                  <em>next journey.</em>
                </>
              )}
            </h1>
            <p>
              {mode === "find"
                ? "Explore charging stations in your region. Pick a place and we’ll show what’s here."
                : "Choose where you’re starting and where you’re going."}
            </p>
          </div>
          <div
            className="finder-tabs"
            role="tablist"
            aria-label="Find stations or plan a trip"
          >
            <button
              role="tab"
              aria-selected={mode === "find"}
              className={mode === "find" ? "active" : ""}
              onClick={() => setMode("find")}
            >
              <MapPin size={16} /> Find stations
            </button>
            <button
              role="tab"
              aria-selected={mode === "trip"}
              className={mode === "trip" ? "active" : ""}
              onClick={() => {
                setMode("trip");
                select(null);
              }}
            >
              <Navigation size={16} /> Plan a trip
            </button>
          </div>
          {mode === "find" ? (
            <>
              <label className="finder-search">
                <Search size={19} />
                <input
                  aria-label="Search stations or cities"
                  placeholder="Search a city or station"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
                {search && (
                  <button
                    aria-label="Clear search"
                    onClick={() => setSearch("")}
                  >
                    <X size={16} />
                  </button>
                )}
              </label>
              <label className="finder-state">
                <span>Explore a state</span>
                <div>
                  <select
                    aria-label="Explore a state"
                    value={state}
                    onChange={(e) => setState(e.target.value)}
                  >
                    <option value="">All six states</option>
                    {REGIONS.map((region) => (
                      <option key={region} value={region}>
                        {region}
                      </option>
                    ))}
                  </select>
                  <ChevronDown size={16} />
                </div>
              </label>
              {!search && !state && (
                <div
                  className="finder-city-chips"
                  aria-label="Quick city search"
                >
                  {[
                    ...new Set(
                      dataset.stations.map((s) => s.city).filter(Boolean),
                    ),
                  ]
                    .slice(0, 3)
                    .map((city) => (
                      <button key={city} onClick={() => setSearch(city!)}>
                        {city} <ArrowRight size={12} />
                      </button>
                    ))}
                </div>
              )}
              <div className="finder-list-heading">
                <span>
                  {stations.length}{" "}
                  {stations.length === 1 ? "station" : "stations"}
                  {state ? ` in ${state}` : " in this dataset"}
                </span>
                {(state || search) && (
                  <button
                    onClick={() => {
                      setState("");
                      setSearch("");
                    }}
                  >
                    Clear filters
                  </button>
                )}
              </div>
              <div className="finder-results" aria-live="polite">
                {!stations.length ? (
                  <div className="finder-empty">
                    <Compass size={34} />
                    <h2>No stations in this dataset</h2>
                    <p>
                      {state && counts[state] === 0
                        ? `The current source has no records for ${state}.`
                        : "Try a different station name, city or state."}{" "}
                      This does not mean there are no chargers there.
                    </p>
                    <button
                      onClick={() => {
                        setState("");
                        setSearch("");
                      }}
                    >
                      Show all regional stations <ArrowRight size={15} />
                    </button>
                  </div>
                ) : (
                  stations.slice(0, shown).map((s) => (
                    <button
                      className={`finder-station ${selected === s.station_id ? "selected" : ""}`}
                      key={s.station_id}
                      onClick={() => select(s.station_id)}
                      aria-label={`View ${s.station_name}, ${s.city || s.state}`}
                    >
                      <span className="finder-station-icon">
                        <Zap size={18} />
                      </span>
                      <span>
                        <strong>{s.station_name}</strong>
                        <small>
                          {s.city || "City not provided"} <i>·</i> {s.state}
                        </small>
                      </span>
                      <ArrowRight size={16} />
                    </button>
                  ))
                )}
                {shown < stations.length && (
                  <button
                    className="finder-load-more"
                    onClick={() => setShown(shown + 12)}
                  >
                    Show more stations <ChevronDown size={15} />
                  </button>
                )}
              </div>
            </>
          ) : (
            <div className="finder-trip">
              <div className="finder-trip-endpoints">
                <EndpointChoice
                  key={`origin-${tripReset}`}
                  label="Starting point"
                  value={origin}
                  onChange={setOrigin}
                  onPickMap={() => setPickOnMap("origin")}
                  stations={dataset.stations}
                />
                <button
                  className="finder-swap"
                  aria-label="Swap starting point and destination"
                  onClick={() => {
                    setOrigin(destination);
                    setDestination(origin);
                    setTripReset((n) => n + 1);
                    setPickOnMap(null);
                  }}
                >
                  <ArrowDownUp size={16} />
                </button>
                <EndpointChoice
                  key={`destination-${tripReset}`}
                  label="Destination"
                  value={destination}
                  onChange={setDestination}
                  onPickMap={() => setPickOnMap("destination")}
                  stations={dataset.stations}
                />
              </div>
              <p className="finder-trip-note">
                Search an address or place, enter latitude, longitude, or choose
                a station. Place searches go to Photon; road routing sends your
                selected points to OSRM. Current location is requested only when
                you tap its button.
              </p>
              <div className="finder-battery-row">
                <Num
                  label="Battery size"
                  unit="kWh"
                  value={vehicle.capacity_kwh}
                  min={1}
                  max={500}
                  onChange={(n) => setVehicle({ ...vehicle, capacity_kwh: n })}
                />
                <Num
                  label="Charge now"
                  unit="%"
                  value={vehicle.initial_soc}
                  min={0}
                  max={100}
                  onChange={(n) => setVehicle({ ...vehicle, initial_soc: n })}
                />
              </div>
              <button
                className="finder-secondary-toggle"
                aria-expanded={powerOptions}
                onClick={() => setPowerOptions(!powerOptions)}
              >
                Vehicle & charging settings <ChevronDown size={14} />
              </button>
              {powerOptions && (
                <div className="finder-extra-settings">
                  {[
                    {
                      key: "consumption_kwh_100km",
                      label: "Consumption",
                      unit: "kWh/100km",
                      min: 1,
                      max: 100,
                    },
                    {
                      key: "reserve_soc",
                      label: "Keep in reserve",
                      unit: "%",
                      min: 0,
                      max: 99,
                    },
                    {
                      key: "target_soc",
                      label: "Charge up to",
                      unit: "%",
                      min: 1,
                      max: 100,
                    },
                    {
                      key: "assumed_charge_power_kw",
                      label: "Assumed charging power",
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
                      label: "Maximum stops",
                      unit: "",
                      min: 0,
                      max: 100,
                    },
                  ].map((f) => (
                    <Num
                      key={f.key}
                      label={f.label}
                      unit={f.unit}
                      value={vehicle[f.key as keyof typeof vehicle]}
                      min={f.min}
                      max={f.max}
                      step={f.step || 1}
                      onChange={(n) => setVehicle({ ...vehicle, [f.key]: n })}
                    />
                  ))}
                  <p>
                    Charging power is your assumption. This source does not
                    provide charger specifications.
                  </p>
                </div>
              )}
              <button
                className="finder-primary"
                disabled={
                  !journeyEndpointsValid(
                    origin,
                    destination,
                    dataset.stations,
                  ) || route.isPending
                }
                onClick={() => route.mutate({ body: routeBody, key: routeKey })}
              >
                {route.isPending ? "Finding your route…" : "Get trip estimate"}
                <ArrowRight size={17} />
              </button>
              {(origin || destination) && (
                <button className="finder-clear-trip" onClick={clearTrip}>
                  Clear trip
                </button>
              )}
              {origin &&
                destination &&
                !journeyEndpointsValid(
                  origin,
                  destination,
                  dataset.stations,
                ) && (
                  <p className="finder-small-note">
                    Choose two different points to plan a trip.
                  </p>
                )}
              {route.error && <Notice error>{route.error.message}</Notice>}
              {result && (
                <div
                  className={`finder-trip-result ${result.found ? "" : "no-route"}`}
                  aria-live="polite"
                >
                  {result.found ? (
                    <>
                      <span className="finder-eyebrow">YOUR TRIP ESTIMATE</span>
                      <h2>
                        {format(result.distance_km)}{" "}
                        <small>
                          km{" "}
                          {result.route_mode === "road"
                            ? "by road"
                            : "geographic estimate"}
                        </small>
                      </h2>
                      <div className="finder-trip-facts">
                        <span>
                          <strong>
                            {format(result.estimated_travel_time_min)} min
                          </strong>
                          Estimated travel
                        </span>
                        <span>
                          <strong>
                            {result.battery.feasible
                              ? `${format(result.battery.final_soc_pct)}%`
                              : "Needs charging"}
                          </strong>
                          Charge at arrival
                        </span>
                      </div>
                      <p>
                        {result.battery.feasible
                          ? "Within your entered battery assumptions."
                          : "This trip needs different battery or charging assumptions."}
                        {result.battery.stops > 0
                          ? ` ${result.battery.stops} modeled charging stop(s), about ${format(result.battery.charging_time_min)} minutes.`
                          : " No charging stops modeled."}
                      </p>
                      {result.road_error && (
                        <Notice>{result.road_error}</Notice>
                      )}
                      <p className="finder-small-note">
                        {result.route_mode === "road"
                          ? "OSRM road estimate · OpenStreetMap contributors · no live traffic"
                          : "Geographic model · not road navigation"}
                      </p>
                      <div className="finder-path">
                        <span>
                          <i>A</i>
                          {origin?.label}
                        </span>
                        {result.stations.map((s: Station, i: number) => (
                          <span key={s.station_id}>
                            <i>{i + 1}</i>
                            {s.station_name}
                          </span>
                        ))}
                        <span>
                          <i>B</i>
                          {destination?.label}
                        </span>
                      </div>
                      {!!providers.data?.gemini_configured && (
                        <div className="finder-ai">
                          <button
                            className="finder-secondary-toggle"
                            disabled={explain.isPending}
                            onClick={() => explain.mutate()}
                          >
                            {explain.isPending
                              ? "Explaining…"
                              : "Explain my trip with Gemini"}
                          </button>
                          <small>
                            Only trip numbers are shared with Google; your
                            address and precise location stay out of the AI
                            prompt.
                          </small>
                          {explain.error && (
                            <Notice error>{explain.error.message}</Notice>
                          )}
                          {explain.data?.key === routeKey && (
                            <p>{explain.data.explanation.text}</p>
                          )}
                        </div>
                      )}
                      <details>
                        <summary>How this estimate works</summary>
                        <p>
                          {result.route_mode === "road"
                            ? "Uses actual OSRM road distances and durations, including your start and end points. Any modeled charging stations are selected from the loaded records near the route, then the road route is recalculated through them."
                            : "Uses geographic connections with a 25 km station radius and an assumed 45 km/h speed, including start/end connector distances. These connections are not roads."}
                          Battery use and charging use your entered assumptions.
                          Charger availability and compatibility are unverified.
                        </p>
                        <p>{result.battery.reason}</p>
                        <button
                          onClick={() =>
                            exportData(
                              "regional-trip",
                              result,
                              result.audit,
                              "json",
                            )
                          }
                        >
                          Download trip details
                        </button>
                      </details>
                    </>
                  ) : (
                    <>
                      <span className="finder-eyebrow">NO CONNECTED ROUTE</span>
                      <h2>No connected route is available in this model.</h2>
                      <p>
                        Try another destination or try again when the road
                        service is available. Missing links in this dataset do
                        not mean the journey is impossible by road.
                      </p>
                    </>
                  )}
                </div>
              )}
              {!result && !route.isPending && (
                <div className="finder-trip-placeholder">
                  <Compass size={26} />
                  <p>
                    {origin && destination
                      ? "Your points are selected. Get your trip estimate."
                      : origin || destination
                        ? "Choose both points, then get your estimate."
                        : "Your next journey starts here."}
                  </p>
                </div>
              )}
              {origin && destination && (
                <p className="finder-endpoint-note">
                  {origin.label} → {destination.label}
                </p>
              )}
            </div>
          )}
          <footer className="finder-sidebar-footer">
            <span>
              <i /> Imported station records
            </span>
            <button onClick={() => setPanel("help")}>
              <CircleHelp size={14} /> A quick guide
            </button>
          </footer>
        </aside>
        <section className="finder-map" aria-label="Station locations">
          <MapView
            simple
            enteredPoints={mode === "trip" ? enteredPoints : []}
            onPointPick={
              pickOnMap
                ? (latitude, longitude) => {
                    const p: TripPoint = {
                      label: `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`,
                      source: "map",
                      point: { latitude, longitude },
                    };
                    (pickOnMap === "origin" ? setOrigin : setDestination)(p);
                    setPickOnMap(null);
                  }
                : undefined
            }
            region={mode === "find" ? state : ""}
            stations={mode === "find" ? stations : dataset.stations}
            edges={[]}
            route={mode === "trip" ? result : null}
            candidates={[]}
            clusters={null}
          />
          {pickOnMap && (
            <div className="finder-map-pick" role="status">
              Click the map to set your{" "}
              {pickOnMap === "origin" ? "starting point" : "destination"}.{" "}
              <button onClick={() => setPickOnMap(null)}>Cancel</button>
            </div>
          )}
          <div className="finder-map-title">
            <span>
              <MapPin size={15} />{" "}
              {mode === "trip"
                ? "Your trip map"
                : state || "Your regional charging map"}
            </span>
            <small>
              {mode === "trip"
                ? "Road routes and modeled battery estimates"
                : "Select a pin or station to explore"}
            </small>
          </div>
          <div className="finder-scope-pill">
            UP <i /> Delhi <i /> Rajasthan <i /> Haryana <i /> Punjab <i /> MP
          </div>
          {station && mode === "find" && (
            <article className="finder-detail">
              <button
                className="finder-detail-close"
                aria-label="Close station details"
                onClick={() => select(null)}
              >
                <X size={19} />
              </button>
              <span className="finder-eyebrow">CHARGING STATION</span>
              <h2>{station.station_name}</h2>
              <p>
                <MapPin size={15} />
                {station.city || "City not provided"}, {station.state}
              </p>
              <div className="finder-detail-actions">
                <button onClick={() => pickTrip(station, "origin")}>
                  <Navigation size={15} /> Start here
                </button>
                <button onClick={() => pickTrip(station, "destination")}>
                  Go here <ArrowRight size={15} />
                </button>
              </div>
              <details>
                <summary>Station information</summary>
                <p>
                  Coordinates: {format(station.latitude, 6)},{" "}
                  {format(station.longitude, 6)}
                </p>
                <p>
                  Live availability, connector type and charger power are not
                  provided by this source. Check before travelling.
                </p>
                {station.address && <p>{station.address}</p>}
                <small>
                  {station.station_id_origin === "derived record hash"
                    ? `Internal record · source row ${station.source_row}`
                    : `Source record ${station.station_id}`}
                </small>
              </details>
            </article>
          )}
        </section>
      </main>
      {panel && (
        <Modal
          title={
            panel === "source"
              ? "About these station records"
              : panel === "tools"
                ? "Project tools"
                : "Find a charging stop"
          }
          onClose={() => setPanel(null)}
        >
          {panel === "source" ? (
            <div className="finder-modal-content">
              <p>
                Showing <strong>{dataset.stations.length} stations</strong> from
                the imported source dataset in the six selected states. Source
                records are not live availability.
              </p>
              <p>{dataset.metadata.source_name}</p>
              <div className="finder-source-counts">
                {REGIONS.map((region) => (
                  <div key={region}>
                    <span>{region}</span>
                    <strong>{counts[region] || 0}</strong>
                  </div>
                ))}
              </div>
              <p>
                The original snapshot is preserved.{" "}
                {dataset.metadata.outside_scope_records} records do not meet the
                selected region checks and are hidden from search, maps and
                analysis.
              </p>
              {!!dataset.metadata.geographic_conflicts_excluded && (
                <p className="finder-small-note">
                  {dataset.metadata.geographic_conflicts_excluded} rows have
                  selected-state labels but coordinates outside the regional
                  map. They are flagged and excluded; source locations have not
                  been corrected. Boundary checking uses cartographic polygons
                  with a 5 km tolerance.
                </p>
              )}
              {!!dataset.metadata.derived_id_records && (
                <p className="finder-small-note">
                  This file has no publisher station IDs. Internal record keys
                  are derived from source-row hashes. Exact repeated rows were
                  removed. The raw type codes have no supplied definition.
                </p>
              )}
              <small>
                Imported{" "}
                {new Date(dataset.metadata.imported_at).toLocaleDateString(
                  "en-IN",
                )}{" "}
                · source snapshot {dataset.metadata.snapshot_id.slice(0, 12)}
              </small>
            </div>
          ) : panel === "tools" ? (
            <div className="finder-modal-content">
              <p>
                Keep everyday searching simple. Open the academic tools when you
                want to study the network.
              </p>
              <button
                className="finder-primary"
                onClick={() => {
                  useUI.getState().set({
                    state: "",
                    city: "",
                    search: "",
                    viva: false,
                    tab: "Network Graph",
                  });
                  select(null);
                  onResearch();
                }}
              >
                Open academic analysis <ArrowRight size={16} />
              </button>
              <button
                className="finder-tool-link"
                disabled={unload.isPending}
                onClick={() => {
                  unload.mutate();
                }}
              >
                <Database size={16} /> Change imported dataset
              </button>
              {unload.error && <Notice error>{unload.error.message}</Notice>}
              <p className="finder-small-note">
                Unloading retains the original snapshot and saved scenarios.
              </p>
            </div>
          ) : (
            <div className="finder-modal-content">
              <p>
                <strong>1. Find a place.</strong> Search a city or station, or
                choose one of the six states.
              </p>
              <p>
                <strong>2. Pick a station.</strong> Select a card or map pin to
                see the location and start a trip.
              </p>
              <p>
                <strong>3. Plan a trip.</strong> Choose two real stations and
                enter your battery size and current charge.
              </p>
              <p className="finder-small-note">
                No records in a state means this source has no data there. Trip
                results are estimates, not road directions or confirmed charging
                availability.
              </p>
            </div>
          )}
        </Modal>
      )}
    </div>
  );
}
