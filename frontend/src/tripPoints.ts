import type { Station } from "./types";
export interface TripPoint {
  label: string;
  source: "station" | "place" | "coordinates" | "current" | "map";
  point: {
    station_id?: string;
    latitude?: number;
    longitude?: number;
    accuracy_m?: number;
  };
}
export function parseCoordinates(
  text: string,
): { latitude: number; longitude: number } | null {
  const match = text
    .trim()
    .match(/^(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)$/);
  if (!match) return null;
  const latitude = Number(match[1]),
    longitude = Number(match[2]);
  return Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    latitude >= 6 &&
    latitude <= 38 &&
    longitude >= 68 &&
    longitude <= 98
    ? { latitude, longitude }
    : null;
}
export function pointCoordinates(value: TripPoint | null, stations: Station[]) {
  if (!value) return null;
  if (value.point.station_id) {
    const station = stations.find(
      (s) => s.station_id === value.point.station_id,
    );
    return station
      ? { latitude: station.latitude, longitude: station.longitude }
      : null;
  }
  const { latitude, longitude } = value.point;
  return latitude !== undefined &&
    longitude !== undefined &&
    parseCoordinates(`${latitude},${longitude}`)
    ? { latitude, longitude }
    : null;
}
export function journeyEndpointsValid(
  a: TripPoint | null,
  b: TripPoint | null,
  stations: Station[],
) {
  const x = pointCoordinates(a, stations),
    y = pointCoordinates(b, stations);
  return (
    !!x &&
    !!y &&
    (Math.abs(x.latitude - y.latitude) > 1e-7 ||
      Math.abs(x.longitude - y.longitude) > 1e-7)
  );
}
