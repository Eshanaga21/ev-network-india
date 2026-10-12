import { useState } from "react";
import { runningCosts, priceValue, money } from "./costs";
import { Modal } from "./shared";

export type Prices = { electricity: string; fuel: string; mileage: string };
export function readPrices(): Prices {
  try {
    const p = JSON.parse(
      localStorage.getItem("ev-network-cost-prices") || "null",
    );
    if (
      p &&
      [p.electricity, p.fuel, p.mileage].every((v) => typeof v === "string")
    )
      return p;
  } catch {
    /* Prices can be entered again. */
  }
  return { electricity: "", fuel: "", mileage: "15" };
}
function PriceFields({
  prices,
  onChange,
}: {
  prices: Prices;
  onChange: (p: Prices) => void;
}) {
  return (
    <div className="cost-inputs">
      {(
        [
          [
            "electricity",
            "Charging price (₹/kWh)",
            "Your home or public charging rate",
          ],
          ["fuel", "Petrol price (₹/litre)", "Price you pay at the pump"],
          [
            "mileage",
            "Petrol-car mileage (km/litre)",
            "Default 15; adjust to your car's mileage",
          ],
        ] as const
      ).map(([key, label, hint]) => (
        <label className="ev-field" key={key}>
          {label}
          <input
            type="number"
            min={key === "mileage" ? 0.1 : 0}
            step="any"
            value={prices[key]}
            placeholder={key === "mileage" ? "km/litre" : "Enter your price"}
            onChange={(e) => onChange({ ...prices, [key]: e.target.value })}
          />
          <small>{hint}</small>
        </label>
      ))}
    </div>
  );
}
function Totals({
  distance,
  consumption,
  efficiency,
  prices,
}: {
  distance: number;
  consumption: number;
  efficiency: number;
  prices: Prices;
}) {
  const totals = runningCosts({
    distanceKm: distance,
    consumption,
    efficiency,
    electricityPrice: priceValue(prices.electricity),
    fuelPrice: priceValue(prices.fuel),
    fuelMileage: priceValue(prices.mileage),
  });
  if (!totals)
    return (
      <p className="cost-note" role="status">
        Enter valid prices (zero is allowed), mileage and driving inputs to see
        the estimate.
      </p>
    );
  return (
    <div className="cost-totals" aria-live="polite">
      <div>
        <small>Estimated EV charging spend</small>
        <strong>{money(totals.evCost)}</strong>
        <span>
          {totals.electricityKwh.toLocaleString("en-IN", {
            maximumFractionDigits: 1,
          })}{" "}
          kWh, including charging losses
        </span>
      </div>
      <div>
        <small>Estimated petrol-car spend</small>
        <strong>{money(totals.carCost)}</strong>
        <span>
          {totals.fuelLitres.toLocaleString("en-IN", {
            maximumFractionDigits: 1,
          })}{" "}
          litres for the same distance
        </span>
      </div>
      <div className={totals.savings >= 0 ? "cost-saved" : "cost-extra"}>
        <small>
          {totals.savings >= 0
            ? "Estimated money saved with EV"
            : "Estimated extra EV cost"}
        </small>
        <strong>{money(Math.abs(totals.savings))}</strong>
        <span>
          {distance.toLocaleString("en-IN", { maximumFractionDigits: 1 })} km
          compared
        </span>
      </div>
    </div>
  );
}
export function TripCostComparison({
  distance,
  consumption,
  efficiency,
  prices,
  onPrices,
}: {
  distance: number;
  consumption: number;
  efficiency: number;
  prices: Prices;
  onPrices: (p: Prices) => void;
}) {
  return (
    <details className="trip-cost">
      <summary>EV vs petrol · trip cost & savings</summary>
      <PriceFields prices={prices} onChange={onPrices} />
      <Totals
        distance={distance}
        consumption={consumption}
        efficiency={efficiency}
        prices={prices}
      />
      <p className="cost-note">
        Energy running costs at your entered rates, including the starting
        battery energy used. This is not a bill for en-route charging stops.
        Actual stop costs above require known station tariffs. Purchase,
        insurance, maintenance, tolls and parking are excluded.
      </p>
    </details>
  );
}
export default function CostComparison({
  consumption,
  efficiency,
  vehicleName,
  prices,
  onPrices,
  onClose,
}: {
  consumption: number;
  efficiency: number;
  vehicleName?: string;
  prices: Prices;
  onPrices: (p: Prices) => void;
  onClose: () => void;
}) {
  const [daily, setDaily] = useState("35"),
    [years, setYears] = useState("5"),
    [usage, setUsage] = useState(String(consumption)),
    [loss, setLoss] = useState(String(Number((efficiency * 100).toFixed(4))));
  const km = priceValue(daily),
    period = priceValue(years),
    validPeriod =
      Number.isFinite(km) &&
      km >= 0 &&
      km <= 10000 &&
      Number.isFinite(period) &&
      period > 0 &&
      period <= 50;
  const totalDistance = validPeriod ? km * 365 * period : NaN;
  return (
    <Modal title="Your charging costs & savings" onClose={onClose}>
      <div className="cost-calculator">
        <p className="cost-lead">See what your everyday driving could save.</p>
        <p className="cost-note">
          {vehicleName
            ? `Using ${vehicleName} driving assumptions.`
            : "No vehicle needed: use your own driving assumptions."}{" "}
          Enter your prices; these are estimates, not recorded spending.
        </p>
        <PriceFields prices={prices} onChange={onPrices} />
        <div className="cost-inputs">
          {[
            {
              label: "Daily distance (km)",
              value: daily,
              set: setDaily,
              min: 0,
              max: 10000,
            },
            {
              label: "Compare over (years)",
              value: years,
              set: setYears,
              min: 0.1,
              max: 50,
            },
            {
              label: "EV consumption (kWh/100 km)",
              value: usage,
              set: setUsage,
              min: 0.1,
              max: 100,
            },
            {
              label: "Charging efficiency (%)",
              value: loss,
              set: setLoss,
              min: 1,
              max: 100,
            },
          ].map((f) => (
            <label className="ev-field" key={f.label}>
              {f.label}
              <input
                type="number"
                min={f.min}
                max={f.max}
                step="any"
                value={f.value}
                onChange={(e) => f.set(e.target.value)}
              />
            </label>
          ))}
        </div>
        <Totals
          distance={totalDistance}
          consumption={priceValue(usage)}
          efficiency={priceValue(loss) / 100}
          prices={prices}
        />
        <p className="cost-note">
          Assumes 365 driving days per year and constant prices. Consumption is
          energy used over 100 km; efficiency allows for energy lost when
          charging. Initial driving values are editable assumptions. This
          comparison covers charging versus petrol only; purchase, insurance,
          maintenance, tolls and parking are excluded.
        </p>
      </div>
    </Modal>
  );
}
