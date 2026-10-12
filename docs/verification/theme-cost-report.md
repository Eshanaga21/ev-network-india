# Theme and cost comparison verification — 12 October 2026

Added a saved light/dark toggle to station browsing, the research console and dataset onboarding. Google Maps selects its corresponding colour scheme when reconstructed; offline map layers change their palette. Vehicle and cost dialogs follow the selected theme. Mobile header actions have icons and accessible labels.

**Cost & savings** works without selecting an EV. With a selected vehicle it starts from that profile's consumption and charging efficiency. Users enter electricity and petrol prices; no market prices or station tariffs are fabricated. The default petrol mileage (15 km/litre), daily distance (35 km), comparison period (5 years), consumption (16 kWh/100 km without a vehicle) and efficiency (90% without a vehicle) are editable assumptions. Prices and mileage are saved locally. The period and driving inputs are temporary calculator choices.

For the same distance D, estimated electricity is D × consumption / 100 / efficiency; petrol volume is D / mileage. Each volume is multiplied by the entered unit price. Savings = petrol spend − charging spend. Negative savings are displayed as extra EV cost. Total distance is daily kilometres × 365 × years. Invalid, blank and non-finite values do not produce totals. Zero prices and zero distance are valid. The comparison excludes purchase price, insurance, maintenance, tolls and parking; it is not recorded spending or comprehensive ownership cost.

Trip comparisons use the returned route distance and battery model's recorded consumption and efficiency. They include starting-battery energy used as running cost; they are distinct from modeled charging-stop costs, which still require known station tariffs.

Verification:

- 35 frontend tests passed, including equal-distance arithmetic, charging losses, period scaling, changed rates, negative savings, zero prices/distance, missing inputs, invalid efficiency/mileage and overflow protection.
- ESLint, TypeScript and Vite production build passed. Existing map bundle size warning remains.
- Live Chromium desktop (1440 × 1000) and mobile (390 × 844) checks passed in both themes with no page exceptions: toggles, theme persistence after reload, saved prices after reload, price recalculation, blank price handling, free charging, zero mileage rejection, modal bounds and all four mobile header controls within the viewport.
- Browser arithmetic: 100 km/day for 1 year at 18 kWh/100 km and 90% efficiency, ₹10/kWh, ₹100/litre and 20 km/litre gives ₹73,000 EV spend, ₹1,82,500 petrol spend and ₹1,09,500 savings. At ₹40/kWh, EV spend becomes ₹2,92,000 and extra EV cost is ₹1,09,500.
- Desktop and mobile screenshots were inspected for contrast and layout. No backend or credential changes were required. Changes remain local.
