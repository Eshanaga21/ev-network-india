import { describe, expect, it } from "vitest";
import { runningCosts, priceValue } from "./costs";
describe("EV and petrol running costs", () => {
  const inputs = {
    distanceKm: 100,
    consumption: 18,
    efficiency: 0.9,
    electricityPrice: 10,
    fuelPrice: 100,
    fuelMileage: 20,
  };
  it("compares the same distance including charging losses", () => {
    expect(runningCosts(inputs)).toEqual({
      electricityKwh: 20,
      fuelLitres: 5,
      evCost: 200,
      carCost: 500,
      savings: 300,
    });
  });
  it("scales total spending across years and recalculates rates", () => {
    const distance = 35 * 365 * 5;
    const r = runningCosts({ ...inputs, distanceKm: distance })!;
    expect(r.evCost).toBe(distance * 2);
    expect(r.carCost).toBe(distance * 5);
    expect(runningCosts({ ...inputs, electricityPrice: 40 })?.savings).toBe(
      -300,
    );
  });
  it("allows zero distance and free energy, without treating missing prices as free", () => {
    expect(runningCosts({ ...inputs, distanceKm: 0 })?.savings).toBe(0);
    expect(runningCosts({ ...inputs, electricityPrice: 0 })?.evCost).toBe(0);
    expect(priceValue("")).toBeNaN();
    expect(priceValue(" ")).toBeNaN();
    expect(priceValue("0")).toBe(0);
  });
  it("rejects invalid values and division by zero", () => {
    for (const changes of [
      { efficiency: 0 },
      { fuelMileage: 0 },
      { electricityPrice: -1 },
      { distanceKm: NaN },
      { fuelPrice: Infinity },
      { consumption: 0 },
      { efficiency: 1.1 },
      { electricityPrice: 1e308 },
    ])
      expect(runningCosts({ ...inputs, ...changes })).toBeNull();
  });
});
