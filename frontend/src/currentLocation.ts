import { parseCoordinates, type TripPoint } from "./tripPoints";

export function requestCurrentLocation(
  geolocation: Pick<Geolocation, "getCurrentPosition"> | undefined,
): Promise<TripPoint> {
  return new Promise((resolve, reject) => {
    if (!geolocation) {
      reject(
        new Error(
          "This browser does not support location. Search a place or enter coordinates.",
        ),
      );
      return;
    }
    geolocation.getCurrentPosition(
      (position) => {
        const point = parseCoordinates(
          `${position.coords.latitude},${position.coords.longitude}`,
        );
        if (
          !point ||
          !Number.isFinite(position.coords.accuracy) ||
          position.coords.accuracy < 0
        ) {
          reject(
            new Error(
              "This app supports valid starting and ending points in India. Search a place or enter coordinates.",
            ),
          );
          return;
        }
        resolve({
          label: "Current location",
          source: "current",
          point: { ...point, accuracy_m: position.coords.accuracy },
        });
      },
      (error) =>
        reject(
          new Error(
            error.code === 1
              ? "Location permission was denied. Allow it in your browser, or search a place / enter coordinates."
              : error.code === 3
                ? "Location timed out. Try again or enter your location manually."
                : "Your location could not be found. Search a place or enter coordinates.",
          ),
        ),
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 },
    );
  });
}
