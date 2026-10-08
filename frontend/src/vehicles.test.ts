import { describe, expect, it } from "vitest";
import {
  EMPTY_GARAGE,
  connectorCompatibility,
  customError,
  planningDefaults,
  preferencesError,
  readGarage,
  remainingRange,
  removeVehicle,
  saveVehicle,
  specFor,
  type EVSpec,
  type SavedEV,
} from "./vehicles";
const small: EVSpec = {
  id: "small",
  manufacturer: "Test",
  model: "Synthetic",
  variant: "Small",
  edition: "Test-only",
  battery_capacity_kwh: 20,
  connector_types: ["CCS2"],
  connector_coverage_complete: true,
  certified_range_km: 200,
  max_ac_charge_kw: null,
  max_dc_charge_kw: null,
  source: null,
};
const large: EVSpec = {
  ...small,
  id: "large",
  variant: "Large",
  battery_capacity_kwh: 40,
  certified_range_km: 400,
};
const saved: SavedEV = {
  id: "small",
  catalog_id: "small",
  preferences: { ...planningDefaults },
};
describe("vehicle planning and local garage", () => {
  it("keeps battery variants separate and recalculates from consumption rather than certified range", () => {
    const a = specFor(saved, [small, large])!;
    const b = specFor({ ...saved, id: "large", catalog_id: "large" }, [
      small,
      large,
    ])!;
    expect(remainingRange(a, planningDefaults)).toBe(87.5);
    expect(remainingRange(b, planningDefaults)).toBe(175);
    expect(
      remainingRange(a, { ...planningDefaults, consumption_kwh_100km: 20 }),
    ).toBe(70);
    expect(
      remainingRange({ ...a, certified_range_km: 999 }, planningDefaults),
    ).toBe(87.5);
  });
  it("supports multiple vehicles, replaces preferences without duplication, and clears removed active/default", () => {
    let g = saveVehicle(EMPTY_GARAGE, saved);
    g = saveVehicle(g, { ...saved, id: "large", catalog_id: "large" });
    expect(g.vehicles).toHaveLength(2);
    expect(g.defaultId).toBe("small");
    expect(g.activeId).toBe("large");
    g = saveVehicle(g, {
      ...saved,
      preferences: { ...planningDefaults, initial_soc: 50 },
    });
    expect(g.vehicles).toHaveLength(2);
    const restored = readGarage(JSON.stringify(g));
    expect(restored).toEqual(g);
    g = removeVehicle(g, "small");
    expect(g.defaultId).toBeNull();
    expect(g.activeId).toBeNull();
    expect(g.vehicles).toHaveLength(1);
  });
  it("rejects corrupt stored profiles and marks removed catalogue editions unavailable", () => {
    expect(readGarage("bad")).toEqual(EMPTY_GARAGE);
    expect(readGarage(JSON.stringify({ version: 9, vehicles: [] }))).toEqual(
      EMPTY_GARAGE,
    );
    const g = readGarage(
      JSON.stringify({
        ...EMPTY_GARAGE,
        activeId: "missing",
        defaultId: "missing",
        vehicles: [saved, { id: "bad", preferences: {} }],
      }),
    );
    expect(g.vehicles).toHaveLength(1);
    expect(g.activeId).toBeNull();
    expect(g.defaultId).toBeNull();
    expect(specFor(saved, [])).toBeNull();
  });
  it("validates custom profiles and leaves charging limits and certified range unknown", () => {
    const custom = {
      name: "My test EV",
      battery_capacity_kwh: 50,
      connector_types: ["Type2"],
      max_ac_charge_kw: null,
      max_dc_charge_kw: null,
    };
    expect(customError(custom)).toBeNull();
    expect(customError({ ...custom, battery_capacity_kwh: NaN })).toBeTruthy();
    expect(customError({ ...custom, connector_types: [] })).toBeTruthy();
    expect(customError({ ...custom, max_dc_charge_kw: 0 })).toBeTruthy();
    const s = specFor(
      { id: "custom", custom, preferences: planningDefaults },
      [],
    )!;
    expect(s.certified_range_km).toBeNull();
    expect(s.max_dc_charge_kw).toBeNull();
  });
  it("validates reserve, consumption, charge target and finite values", () => {
    expect(preferencesError(planningDefaults)).toBeNull();
    for (const p of [
      { consumption_kwh_100km: 0 },
      { initial_soc: NaN },
      { reserve_soc: 90 },
      { average_charge_fraction: 1.1 },
      { max_stops: 1.5 },
    ])
      expect(preferencesError({ ...planningDefaults, ...p })).toBeTruthy();
  });
  it("matches connector aliases without claiming missing or incomplete data is incompatible", () => {
    expect(
      connectorCompatibility(small, { connector_type: "CCS Combo 2;Type 2" }),
    ).toBe("compatible");
    expect(connectorCompatibility(small, { connector_type: "CHAdeMO" })).toBe(
      "incompatible",
    );
    expect(connectorCompatibility(small, { connector_type: null })).toBe(
      "unknown",
    );
    expect(
      connectorCompatibility(small, { connector_type: "CCS1;undefined" }),
    ).toBe("unknown");
    expect(
      connectorCompatibility(
        { ...small, connector_coverage_complete: false },
        { connector_type: "Type2" },
      ),
    ).toBe("unknown");
  });
});
