export type CostInputs = {
  distanceKm: number;
  consumption: number;
  efficiency: number;
  electricityPrice: number;
  fuelPrice: number;
  fuelMileage: number;
};
export function runningCosts(input: CostInputs) {
  if (
    !Object.values(input).every(Number.isFinite) ||
    input.distanceKm < 0 ||
    input.consumption <= 0 ||
    input.consumption > 100 ||
    input.efficiency <= 0 ||
    input.efficiency > 1 ||
    input.electricityPrice < 0 ||
    input.fuelPrice < 0 ||
    input.fuelMileage <= 0 ||
    input.fuelMileage > 100
  )
    return null;
  const electricityKwh =
    (input.distanceKm * input.consumption) / 100 / input.efficiency;
  const fuelLitres = input.distanceKm / input.fuelMileage;
  const evCost = electricityKwh * input.electricityPrice;
  const carCost = fuelLitres * input.fuelPrice;
  const totals = {
    electricityKwh,
    fuelLitres,
    evCost,
    carCost,
    savings: carCost - evCost,
  };
  return Object.values(totals).every(Number.isFinite) ? totals : null;
}
export function priceValue(value: string) {
  return value.trim() === "" ? NaN : Number(value);
}
export const money = (value: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);
