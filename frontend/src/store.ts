import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Endpoint, GraphSettings, Tab, Vehicle } from "./types";
export const defaultSettings = {
  tab: "Trip Planner" as Tab,
  graph: {
    method: "radius",
    radius_km: 25,
    k: 3,
    speed_kmh: 45,
  } as GraphSettings,
  state: "",
  city: "",
  search: "",
  viva: false,
  origin: {
    mode: "station",
    station_id: "",
    latitude: "",
    longitude: "",
  } as Endpoint,
  destination: {
    mode: "station",
    station_id: "",
    latitude: "",
    longitude: "",
  } as Endpoint,
  algorithm: "dijkstra" as "dijkstra" | "astar",
  vehicle: {
    capacity_kwh: 50,
    initial_soc: 80,
    consumption_kwh_100km: 16,
    reserve_soc: 10,
    target_soc: 90,
    assumed_charge_power_kw: 30,
    charge_efficiency: 0.9,
    max_stops: 5,
  } as Vehicle,
  outage: "",
  weights: {
    distance: 35,
    density: 35,
    connectivity: 30,
    availability: 0,
    ports: 0,
    power: 0,
  } as Record<string, number>,
  radius: 25,
  clusterRadius: 15,
  minSamples: 3,
  nodeMetric: "availability",
  edgeMetric: "distance_km",
  highlight: "none",
  heatmap: false,
  comparison: [] as string[],
  scenarioName: "",
};
export type Settings = typeof defaultSettings;
interface UIStore {
  settings: Settings;
  selected: string | null;
  panel: string | null;
  set: (updates: Partial<Settings>) => void;
  select: (id: string | null) => void;
  show: (panel: string | null) => void;
  reset: () => void;
}
export const useUI = create<UIStore>()(
  persist(
    (set) => ({
      settings: { ...defaultSettings },
      selected: null,
      panel: null,
      set: (updates) =>
        set((s) => ({ settings: { ...s.settings, ...updates } })),
      select: (selected) => set({ selected }),
      show: (panel) => set({ panel }),
      reset: () => set({ settings: { ...defaultSettings }, selected: null }),
    }),
    {
      name: "ev-console-settings",
      partialize: (s) => ({ settings: s.settings }),
    },
  ),
);
export function context(settings: Settings) {
  return {
    graph: settings.graph,
    state: settings.state || null,
    city: settings.city || null,
    search: settings.search,
  };
}
export function resolveEndpoint(endpoint: Endpoint) {
  return endpoint.mode === "station"
    ? { station_id: endpoint.station_id }
    : {
        latitude: Number(endpoint.latitude),
        longitude: Number(endpoint.longitude),
      };
}
export function endpointValid(endpoint: Endpoint) {
  return endpoint.mode === "station"
    ? Boolean(endpoint.station_id)
    : endpoint.latitude.trim() !== "" &&
        endpoint.longitude.trim() !== "" &&
        Number.isFinite(Number(endpoint.latitude)) &&
        Number.isFinite(Number(endpoint.longitude));
}
