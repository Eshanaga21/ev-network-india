import { describe, expect, it } from "vitest";
import { navigationUrl, tripNavigation } from "./navigation";
import type { TripPoint } from "./tripPoints";
import type { Station } from "./types";
const start: TripPoint = {
  label: "Entered start",
  source: "coordinates",
  point: { latitude: 28.6129, longitude: 77.2295 },
};
const end: TripPoint = {
  label: "Entered end",
  source: "map",
  point: { latitude: 28.47, longitude: 77.08 },
};
const stops = Array.from({ length: 5 }, (_, i) => ({
  station_id: `${i}`,
  station_name: `Source stop ${i}`,
  latitude: 28.6 - i * 0.01,
  longitude: 77.2,
})) as Station[];
const result = {
  found: true,
  battery: { feasible: true },
  route_mode: "road",
  stations: stops,
};
describe("Google Maps navigation handoff", () => {
  it("preserves arbitrary start and end coordinates in a driving link", () => {
    const url = new URL(navigationUrl(end.point as any, start.point as any)!);
    expect(url.hostname).toBe("www.google.com");
    expect(url.searchParams.get("origin")).toBe("28.6129,77.2295");
    expect(url.searchParams.get("destination")).toBe("28.47,77.08");
    expect(url.searchParams.get("dir_action")).toBe("navigate");
    expect(url.searchParams.get("travelmode")).toBe("driving");
    expect(url.searchParams.has("key")).toBe(false);
  });
  it("keeps every charging waypoint even when mobile waypoint limits would be exceeded", () => {
    const legs = tripNavigation(start, end, stops, result);
    expect(legs).toHaveLength(6);
    expect(legs.slice(0, 5).map((leg) => leg.label)).toEqual(
      stops.map((s) => s.station_name),
    );
    expect(new URL(legs[0].url!).searchParams.get("origin")).toBe(
      "28.6129,77.2295",
    );
    for (const leg of legs.slice(1))
      expect(new URL(leg.url!).searchParams.has("origin")).toBe(false);
    expect(new URL(legs[5].url!).searchParams.get("destination")).toBe(
      "28.47,77.08",
    );
  });
  it("uses device position for a current-location start instead of stale GPS", () => {
    const leg = tripNavigation(
      { ...start, source: "current" },
      end,
      stops,
      result,
    )[0];
    expect(new URL(leg.url!).searchParams.has("origin")).toBe(false);
  });
  it("does not present geographic graph stops as a verified driving itinerary", () => {
    expect(
      tripNavigation(start, end, stops, {
        ...result,
        route_mode: "geographic",
      }),
    ).toHaveLength(1);
  });
  it("withholds trip navigation for infeasible, missing or invalid plans", () => {
    for (const plan of [
      null,
      { ...result, found: false },
      { ...result, battery: { feasible: false } },
      { ...result, stations: [{ latitude: NaN, longitude: 77 }] },
    ])
      expect(tripNavigation(start, end, stops, plan)).toEqual([]);
    expect(tripNavigation(null, end, stops, result)).toEqual([]);
    expect(navigationUrl({ latitude: 91, longitude: 77 })).toBeNull();
  });
});
