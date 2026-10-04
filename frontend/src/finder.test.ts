import { describe, it, expect } from "vitest";
import { findStations, REGIONS, routeEndpointsValid } from "./finder";
import type { Station } from "./types";
const stations = [
  {
    station_id: "a",
    station_name: "Recorded point A",
    city: "Noida",
    state: "Uttar Pradesh",
    address: "Sector 18",
  },
  {
    station_id: "b",
    station_name: "Recorded point B",
    city: "Delhi",
    state: "Delhi",
  },
] as Station[];
describe("minimal regional finder", () => {
  it("lists exactly the six requested states", () => {
    expect(REGIONS).toEqual([
      "Uttar Pradesh",
      "Delhi",
      "Rajasthan",
      "Haryana",
      "Punjab",
      "Madhya Pradesh",
    ]);
  });
  it("searches case-insensitive names, cities and state words", () => {
    expect(findStations(stations, "", "NOIDA")[0].station_id).toBe("a");
    expect(findStations(stations, "", "uttar pradesh")).toHaveLength(1);
    expect(findStations(stations, "", "point b")[0].station_id).toBe("b");
  });
  it("searches supplied addresses without adding location fields", () => {
    expect(findStations(stations, "", "sector 18")[0].station_id).toBe("a");
  });
  it("combines search and state and leaves missing states empty", () => {
    expect(findStations(stations, "Delhi", "Noida")).toEqual([]);
    expect(findStations(stations, "Rajasthan", "")).toEqual([]);
  });
  it("requires distinct observed endpoints", () => {
    expect(routeEndpointsValid("a", "b", stations)).toBe(true);
    expect(routeEndpointsValid("a", "a", stations)).toBe(false);
    expect(routeEndpointsValid("a", "unknown", stations)).toBe(false);
    expect(routeEndpointsValid("", "b", stations)).toBe(false);
  });
});
