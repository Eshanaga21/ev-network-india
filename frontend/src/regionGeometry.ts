// Bounds derived from the local Natural Earth polygons; not station records.
export const REGION_BOUNDS: Record<
  string,
  [[number, number], [number, number]]
> = {
  Punjab: [
    [73.842345, 29.559824],
    [76.910376, 32.516749],
  ],
  Rajasthan: [
    [69.465093, 23.036062],
    [78.246521, 30.204077],
  ],
  "Uttar Pradesh": [
    [77.05817, 23.911047],
    [84.612438, 30.402021],
  ],
  Delhi: [
    [76.833688, 28.432606],
    [77.337533, 28.882088],
  ],
  "Madhya Pradesh": [
    [74.024867, 21.074812],
    [82.818025, 26.859808],
  ],
  Haryana: [
    [74.459362, 27.670404],
    [77.587957, 30.934262],
  ],
};
