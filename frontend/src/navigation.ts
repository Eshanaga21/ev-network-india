import type { Station } from "./types";
import { pointCoordinates, type TripPoint } from "./tripPoints";

// Google decides whether to open app navigation or a web route preview.
// Each leg has one destination, so mobile waypoint limits cannot skip charging stops.
export function navigationUrl(
  destination: { latitude: number; longitude: number },
  origin?: { latitude: number; longitude: number } | null,
) {
  const valid = (p: { latitude: number; longitude: number }) =>
    Number.isFinite(p.latitude) &&
    Number.isFinite(p.longitude) &&
    Math.abs(p.latitude) <= 90 &&
    Math.abs(p.longitude) <= 180;
  if (!valid(destination) || (origin && !valid(origin))) return null;
  const params = new URLSearchParams({
    api: "1",
    destination: `${destination.latitude},${destination.longitude}`,
    travelmode: "driving",
    dir_action: "navigate",
  });
  if (origin) params.set("origin", `${origin.latitude},${origin.longitude}`);
  return `https://www.google.com/maps/dir/?${params}`;
}

export function tripNavigation(
  origin: TripPoint | null,
  destination: TripPoint | null,
  stations: Station[],
  result: any,
) {
  const start = pointCoordinates(origin, stations),
    end = pointCoordinates(destination, stations);
  if (!start || !end || !result?.found || !result.battery?.feasible) return [];
  const targets: { label: string; latitude: number; longitude: number }[] =
    result.route_mode === "road"
      ? result.stations.map((s: Station) => ({
          label: s.station_name,
          latitude: s.latitude,
          longitude: s.longitude,
        }))
      : [];
  targets.push({ ...end, label: destination!.label });
  // Preserve entered coordinates for the first leg. A current-location selection
  // delegates the first origin to the device to avoid reusing an old GPS fix.
  const legs = targets.map((target, i) => ({
    label: target.label,
    url: navigationUrl(
      target,
      i === 0 ? (origin?.source === "current" ? null : start) : null,
    ),
  }));
  return legs.every((leg) => leg.url) ? legs : [];
}
