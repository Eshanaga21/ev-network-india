export type Tab =
  | "Trip Planner"
  | "Infrastructure"
  | "Network Graph"
  | "Resilience"
  | "Accessibility"
  | "Expansion"
  | "Methodology";
export interface GraphSettings {
  method: "radius" | "knn";
  radius_km: number;
  k: number;
  speed_kmh: number;
}
export interface Vehicle {
  capacity_kwh: number;
  initial_soc: number;
  consumption_kwh_100km: number;
  reserve_soc: number;
  target_soc: number;
  assumed_charge_power_kw: number;
  charge_efficiency: number;
  max_stops: number;
}
export interface Station {
  station_id: string;
  station_name: string;
  latitude: number;
  longitude: number;
  city: string | null;
  state: string | null;
  country: string | null;
  operator: string | null;
  status: string | null;
  availability: string | null;
  connector_type: string | null;
  num_chargers: number | null;
  charging_power_kw: number | null;
  data_completeness_pct: number;
  [key: string]: any;
}
export interface Dataset {
  loaded: boolean;
  stations: Station[];
  metadata: any;
}
export interface Endpoint {
  mode: "station" | "coordinates";
  station_id: string;
  latitude: string;
  longitude: string;
}
