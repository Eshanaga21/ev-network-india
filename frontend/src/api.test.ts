import { describe, expect, it, vi, afterEach } from "vitest";
import { csvCell, exportData, format, request } from "./api";
import {
  context,
  defaultSettings,
  endpointValid,
  resolveEndpoint,
} from "./store";
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
describe("safe audited exports and source-aware state", () => {
  it("escapes CSV quotes, nulls, objects and formula injection", () => {
    expect(csvCell("=1+1")).toBe('"\'=1+1"');
    expect(csvCell('a"b')).toBe('"a""b"');
    expect(csvCell(null)).toBe('""');
    expect(csvCell({ snapshot_id: "abc" })).toContain("snapshot_id");
  });
  it("never shows an invented value for missing metrics", () => {
    expect(format(null)).toBe("—");
    expect(format(Number.NaN)).toBe("—");
    expect(format(1.25, 2)).toBe("1.25");
  });
  it("has no default station or fake coordinates", () => {
    expect(defaultSettings.origin.station_id).toBe("");
    expect(defaultSettings.origin.latitude).toBe("");
    expect(defaultSettings.destination.station_id).toBe("");
    expect(defaultSettings.comparison).toEqual([]);
  });
  it("requires explicit endpoint data", () => {
    expect(endpointValid(defaultSettings.origin)).toBe(false);
    expect(
      endpointValid({
        ...defaultSettings.origin,
        mode: "coordinates",
        latitude: "",
        longitude: "",
      }),
    ).toBe(false);
    expect(
      endpointValid({
        ...defaultSettings.origin,
        mode: "coordinates",
        latitude: "28",
        longitude: "77",
      }),
    ).toBe(true);
    expect(
      resolveEndpoint({ ...defaultSettings.origin, station_id: "real-id" }),
    ).toEqual({ station_id: "real-id" });
  });
  it("preserves graph and filters for reproducibility", () => {
    expect(
      context({ ...defaultSettings, state: "Delhi", city: "Delhi" }),
    ).toMatchObject({
      state: "Delhi",
      city: "Delhi",
      graph: { radius_km: 25 },
    });
  });
  it("surfaces missing dataset errors", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ detail: "No dataset loaded" }),
      }),
    );
    await expect(request("analysis", {})).rejects.toThrow("No dataset loaded");
  });
  it("explains structured validation failures", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        json: () =>
          Promise.resolve({
            detail: [{ loc: ["body", "weights"], msg: "must total 100%" }],
          }),
      }),
    );
    await expect(request("accessibility", {})).rejects.toThrow(
      "weights: must total 100%",
    );
  });
});

describe("downloaded artifacts", () => {
  it.each(["json", "csv"] as const)(
    "includes audit and complete results in %s",
    async (kind) => {
      vi.useFakeTimers();
      let blob: Blob | undefined;
      const create = vi.fn((input: Blob) => {
        blob = input;
        return "blob:local-export";
      });
      const revoke = vi.fn();
      const anchor = { href: "", download: "", click: vi.fn() };
      vi.stubGlobal("URL", {
        createObjectURL: create,
        revokeObjectURL: revoke,
      });
      vi.stubGlobal("document", { createElement: vi.fn(() => anchor) });
      exportData(
        "stations",
        [{ station_id: "observed-1", status: null }],
        { snapshot_id: "immutable-1", graph: { radius_km: 12 } },
        kind,
      );
      const content = await blob!.text();
      expect(content).toContain("immutable-1");
      expect(content).toContain("observed-1");
      expect(anchor.download).toBe(`stations.${kind}`);
      expect(anchor.click).toHaveBeenCalledOnce();
      if (kind === "json")
        expect(JSON.parse(content).results[0].status).toBeNull();
      else expect(content).toContain("_analysis_audit");
      vi.runAllTimers();
      expect(revoke).toHaveBeenCalledWith("blob:local-export");
    },
  );
});
