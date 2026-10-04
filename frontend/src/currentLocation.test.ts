import { describe, it, expect, vi } from "vitest";
import { requestCurrentLocation } from "./currentLocation";

describe("explicit device location request", () => {
  it("preserves actual device coordinates and accuracy with bounded location options", async () => {
    const getCurrentPosition = vi.fn((success: PositionCallback) =>
      success({
        coords: { latitude: 28.6129332, longitude: 77.2294928, accuracy: 18 },
      } as GeolocationPosition),
    );
    const result = await requestCurrentLocation({ getCurrentPosition });
    expect(result.point).toEqual({
      latitude: 28.6129332,
      longitude: 77.2294928,
      accuracy_m: 18,
    });
    expect(result.source).toBe("current");
    expect(getCurrentPosition.mock.calls[0]).toHaveLength(3);
    expect((getCurrentPosition.mock.calls[0] as unknown[])[2]).toEqual({
      enableHighAccuracy: true,
      timeout: 12000,
      maximumAge: 60000,
    });
  });
  it("returns actionable permission and timeout errors without a substitute location", async () => {
    for (const [code, message] of [
      [1, "denied"],
      [3, "timed out"],
      [2, "could not be found"],
    ] as const) {
      const getCurrentPosition = vi.fn(
        (_success: PositionCallback, error?: PositionErrorCallback | null) =>
          error?.({ code } as GeolocationPositionError),
      );
      await expect(
        requestCurrentLocation({ getCurrentPosition }),
      ).rejects.toThrow(message);
    }
    await expect(requestCurrentLocation(undefined)).rejects.toThrow(
      "does not support",
    );
  });
  it("rejects unsupported coordinates and invalid device accuracy", async () => {
    for (const [latitude, longitude, accuracy] of [
      [0, 0, 5],
      [28, 77, NaN],
      [28, 77, -1],
    ]) {
      const getCurrentPosition = vi.fn((success: PositionCallback) =>
        success({
          coords: { latitude, longitude, accuracy },
        } as GeolocationPosition),
      );
      await expect(
        requestCurrentLocation({ getCurrentPosition }),
      ).rejects.toThrow("valid starting");
    }
  });
});
