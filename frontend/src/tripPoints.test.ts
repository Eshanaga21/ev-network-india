import { describe, it, expect } from "vitest";
import {
  parseCoordinates,
  pointCoordinates,
  journeyEndpointsValid,
  type TripPoint,
} from "./tripPoints";
import type { Station } from "./types";
const stations = [
  { station_id: "a", latitude: 28.6, longitude: 77.2 },
] as Station[];
const a: TripPoint = {
  label: "Entered place",
  source: "coordinates",
  point: { latitude: 28.61, longitude: 77.21 },
};
const b: TripPoint = {
  label: "Source station",
  source: "station",
  point: { station_id: "a" },
};
describe("any-point trip endpoints", () => {
  it("accepts latitude, longitude including spaces but rejects invalid coordinates", () => {
    expect(parseCoordinates(" 28.6129, 77.2295 ")).toEqual({
      latitude: 28.6129,
      longitude: 77.2295,
    });
    for (const text of ["home", "NaN,77", "0,0", "91,77", "28,200", "28,77,12"])
      expect(parseCoordinates(text)).toBeNull();
  });
  it("resolves only an actual selected station ID", () => {
    expect(pointCoordinates(b, stations)).toEqual({
      latitude: 28.6,
      longitude: 77.2,
    });
    expect(
      pointCoordinates({ ...b, point: { station_id: "missing" } }, stations),
    ).toBeNull();
  });
  it("supports place-to-station and place-to-place without requiring a station start", () => {
    expect(journeyEndpointsValid(a, b, stations)).toBe(true);
    expect(
      journeyEndpointsValid(
        a,
        { ...a, point: { latitude: 29, longitude: 77 } },
        stations,
      ),
    ).toBe(true);
    expect(journeyEndpointsValid(a, a, stations)).toBe(false);
    expect(journeyEndpointsValid(null, b, stations)).toBe(false);
  });
});
