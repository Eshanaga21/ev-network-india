import type { Station, Vehicle } from "./types";
export const CONNECTORS = [
  "CCS2",
  "Type2",
  "CHAdeMO",
  "GB/T DC",
  "GB/T AC",
  "CCS1",
  "Type1",
  "NACS",
] as const;
export type EVSpec = {
  id: string;
  manufacturer: string;
  model: string;
  variant: string;
  edition: string;
  battery_capacity_kwh: number;
  connector_types: string[];
  connector_coverage_complete: boolean;
  certified_range_km: number | null;
  range_standard?: string;
  max_ac_charge_kw: number | null;
  max_dc_charge_kw: number | null;
  charging_reference?: string;
  source: { title: string; url: string } | null;
  verified_on?: string;
  notes?: string;
};
export type CustomEV = {
  name: string;
  battery_capacity_kwh: number;
  connector_types: string[];
  max_ac_charge_kw: number | null;
  max_dc_charge_kw: number | null;
};
export type Preferences = Vehicle & { average_charge_fraction: number };
export type SavedEV = {
  id: string;
  catalog_id?: string;
  custom?: CustomEV;
  preferences: Preferences;
};
export type Garage = {
  version: 1;
  vehicles: SavedEV[];
  activeId: string | null;
  defaultId: string | null;
};
export const EMPTY_GARAGE: Garage = {
  version: 1,
  vehicles: [],
  activeId: null,
  defaultId: null,
};
export const GARAGE_KEY = "ev-network-garage-v1";
export const planningDefaults: Preferences = {
  capacity_kwh: 50,
  initial_soc: 80,
  reserve_soc: 10,
  target_soc: 90,
  consumption_kwh_100km: 16,
  assumed_charge_power_kw: 30,
  charge_efficiency: 0.9,
  average_charge_fraction: 0.7,
  max_stops: 5,
};
export function preferencesError(p: Preferences): string | null {
  const fields: [number, number, number, string, boolean?][] = [
    [p.initial_soc, 0, 100, "Current charge"],
    [p.reserve_soc, 0, 99, "Arrival reserve"],
    [p.target_soc, 1, 100, "Charge target"],
    [p.consumption_kwh_100km, 0, 100, "Consumption", true],
    [p.charge_efficiency, 0, 1, "Charging efficiency", true],
    [p.average_charge_fraction, 0, 0.99, "Average-charge fraction", true],
    [p.max_stops, 0, 100, "Maximum stops"],
  ];
  for (const [value, min, max, label, strict] of fields)
    if (
      !Number.isFinite(value) ||
      value < min ||
      (strict && value === min) ||
      value > max
    )
      return `${label} must be ${strict ? "above" : "at least"} ${min} and at most ${max}.`;
  if (!Number.isInteger(p.max_stops))
    return "Maximum stops must be a whole number.";
  if (p.target_soc <= p.reserve_soc)
    return "Charge target must exceed arrival reserve.";
  if (p.initial_soc < p.reserve_soc)
    return "Current charge must be at least your arrival reserve.";
  return null;
}
export function customError(v: CustomEV): string | null {
  if (!v.name.trim() || v.name.trim().length > 80)
    return "Enter a vehicle name (up to 80 characters).";
  if (
    !Number.isFinite(v.battery_capacity_kwh) ||
    v.battery_capacity_kwh <= 0 ||
    v.battery_capacity_kwh > 500
  )
    return "Battery capacity must be above 0 and at most 500 kWh.";
  if (
    !v.connector_types.length ||
    v.connector_types.some(
      (c) => !CONNECTORS.includes(c as (typeof CONNECTORS)[number]),
    )
  )
    return "Select at least one supported connector type.";
  for (const p of [v.max_ac_charge_kw, v.max_dc_charge_kw])
    if (p !== null && (!Number.isFinite(p) || p <= 0 || p > 1000))
      return "Charging limits must be above 0 and at most 1000 kW, or left blank if unknown.";
  return null;
}
export function readGarage(raw: string | null): Garage {
  try {
    const g = JSON.parse(raw || "null");
    if (g?.version !== 1 || !Array.isArray(g.vehicles)) return EMPTY_GARAGE;
    const vehicles: SavedEV[] = g.vehicles.filter(
      (v: SavedEV) =>
        v &&
        typeof v.id === "string" &&
        v.preferences &&
        !preferencesError(v.preferences) &&
        ((typeof v.catalog_id === "string" && !v.custom) ||
          (v.custom && !v.catalog_id && !customError(v.custom))),
    );
    const exists = (id: unknown) =>
      typeof id === "string" && vehicles.some((v) => v.id === id);
    return {
      version: 1,
      vehicles,
      activeId: exists(g.activeId) ? g.activeId : null,
      defaultId: exists(g.defaultId) ? g.defaultId : null,
    };
  } catch {
    return EMPTY_GARAGE;
  }
}
export function saveVehicle(g: Garage, v: SavedEV): Garage {
  return {
    ...g,
    vehicles: [...g.vehicles.filter((x) => x.id !== v.id), v],
    activeId: v.id,
    defaultId: g.defaultId || v.id,
  };
}
export function removeVehicle(g: Garage, id: string): Garage {
  return {
    ...g,
    vehicles: g.vehicles.filter((v) => v.id !== id),
    activeId: g.activeId === id ? null : g.activeId,
    defaultId: g.defaultId === id ? null : g.defaultId,
  };
}
export function specFor(
  saved: SavedEV | undefined,
  catalog: EVSpec[],
): EVSpec | null {
  if (!saved) return null;
  if (saved.custom)
    return {
      id: saved.id,
      manufacturer: "Custom",
      model: saved.custom.name,
      variant: "Owner-entered profile",
      edition: "Your specifications",
      ...saved.custom,
      connector_coverage_complete: true,
      certified_range_km: null,
      source: null,
    };
  return catalog.find((v) => v.id === saved.catalog_id) || null;
}
export function remainingRange(spec: EVSpec, p: Preferences) {
  return (
    (spec.battery_capacity_kwh * Math.max(0, p.initial_soc - p.reserve_soc)) /
    p.consumption_kwh_100km
  );
}
export function connectorCompatibility(
  spec: EVSpec,
  station: Pick<Station, "connector_type">,
) {
  const aliases: Record<string, string> = {
    ccs2: "CCS2",
    ccscombo2: "CCS2",
    ccstype2: "CCS2",
    type2: "Type2",
    mennekes: "Type2",
    chademo: "CHAdeMO",
    "gb/tdc": "GB/T DC",
    "gb/tac": "GB/T AC",
    ccs1: "CCS1",
    ccscombo1: "CCS1",
    type1: "Type1",
    j1772: "Type1",
    nacs: "NACS",
  };
  const tokens = (station.connector_type || "")
    .split(/[,;|+]/)
    .map((v) => aliases[v.replace(/[\s_\-()]/g, "").toLowerCase()]);
  if (tokens.some((t) => spec.connector_types.includes(t))) return "compatible";
  if (
    tokens.length &&
    tokens.every(Boolean) &&
    spec.connector_coverage_complete
  )
    return "incompatible";
  return "unknown";
}
export const compatibilityLabel = {
  compatible: "Matching connector",
  incompatible: "Incompatible connector",
  unknown: "Compatibility unknown",
};
