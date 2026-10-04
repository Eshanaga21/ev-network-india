import type { Station } from "./types";
export const REGIONS = [
  "Uttar Pradesh",
  "Delhi",
  "Rajasthan",
  "Haryana",
  "Punjab",
  "Madhya Pradesh",
];
export function findStations(
  stations: Station[],
  state: string,
  search: string,
) {
  const terms = search.trim().toLowerCase().split(/\s+/).filter(Boolean);
  return stations.filter(
    (s) =>
      (!state || s.state === state) &&
      terms.every((term) =>
        `${s.station_name} ${s.city || ""} ${s.state || ""} ${s.address || ""}`
          .toLowerCase()
          .includes(term),
      ),
  );
}
export function routeEndpointsValid(
  origin: string,
  destination: string,
  stations: Station[],
) {
  return (
    !!origin &&
    !!destination &&
    origin !== destination &&
    [origin, destination].every((id) =>
      stations.some((s) => s.station_id === id),
    )
  );
}
