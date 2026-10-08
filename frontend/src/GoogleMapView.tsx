import { useEffect, useRef, useState } from "react";
import { LocateFixed } from "lucide-react";
import type { Station } from "./types";
import { useUI } from "./store";
import { REGION_BOUNDS } from "./regionGeometry";
import { loadGoogleMaps } from "./googleMapsLoader";
import {
  MarkerClusterer,
  SuperClusterAlgorithm,
} from "@googlemaps/markerclusterer";

export default function GoogleMapView({
  config,
  stations,
  route,
  region,
  enteredPoints,
  onPointPick,
}: {
  config: { browser_key: string; map_id: string };
  stations: Station[];
  route: any;
  region: string;
  enteredPoints: { latitude: number; longitude: number; label: string }[];
  onPointPick?: (latitude: number, longitude: number) => void;
}) {
  const element = useRef<HTMLDivElement>(null),
    map = useRef<any>(null),
    sdk = useRef<any>(null);
  const [ready, setReady] = useState(false),
    [error, setError] = useState("");
  const selected = useUI((s) => s.selected),
    select = useUI((s) => s.select);
  const pick = useRef(onPointPick);
  pick.current = onPointPick;
  useEffect(() => {
    let cancelled = false;
    const listeners: any[] = [];
    const authFailure = () =>
      setError(
        "Google Maps rejected the browser key. Check Maps JavaScript API, billing and allowed websites.",
      );
    window.addEventListener("ev-google-auth-error", authFailure);
    void loadGoogleMaps(config.browser_key)
      .then(async (maps) => {
        const markers = await maps.importLibrary("marker");
        if (cancelled || !element.current) return;
        sdk.current = { ...maps, ...markers };
        const m = new maps.Map(element.current, {
          center: { lat: 28.6, lng: 77.2 },
          zoom: 6,
          mapId: config.map_id,
          colorScheme: maps.ColorScheme?.DARK,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: true,
          clickableIcons: false,
          gestureHandling: "cooperative",
        });
        map.current = m;
        listeners.push(
          m.addListener("click", (event: any) => {
            if (!pick.current || !event.latLng) return;
            const lat = event.latLng.lat(),
              lon = event.latLng.lng();
            if (lat >= 6 && lat <= 38 && lon >= 68 && lon <= 98)
              pick.current(lat, lon);
          }),
        );
        setReady(true);
      })
      .catch(() => {
        if (!cancelled) authFailure();
      });
    return () => {
      cancelled = true;
      listeners.forEach((l) => l.remove());
      map.current = null;
      window.removeEventListener("ev-google-auth-error", authFailure);
    };
  }, [config.browser_key, config.map_id]);
  const pointsKey = JSON.stringify(enteredPoints);
  useEffect(() => {
    if (!ready || !sdk.current || !map.current) return;
    const m = map.current,
      maps = sdk.current;
    const overlays: any[] = [],
      listeners: any[] = [];
    const addMarker = (
      latitude: number,
      longitude: number,
      label: string,
      title: string,
      onClick?: () => void,
    ) => {
      const content = document.createElement("div");
      content.className =
        label === "A" || label === "B"
          ? "finder-endpoint-pin"
          : "finder-google-station";
      content.textContent = label;
      content.setAttribute("aria-label", title);
      const marker = new maps.AdvancedMarkerElement({
        map: label === "A" || label === "B" ? m : null,
        position: { lat: latitude, lng: longitude },
        title,
        content,
        zIndex: label === "A" || label === "B" ? 1000 : 1,
      });
      if (onClick) listeners.push(marker.addListener("click", onClick));
      overlays.push(marker);
      return marker;
    };
    const stationMarkers = stations.map((s) =>
      addMarker(s.latitude, s.longitude, "ϟ", s.station_name, () => {
        if (pick.current) pick.current(s.latitude, s.longitude);
        else select(s.station_id);
      }),
    );
    const clusterer = new MarkerClusterer({
      map: m,
      markers: stationMarkers,
      algorithm: new SuperClusterAlgorithm({ radius: 50, maxZoom: 12 }),
      renderer: {
        render: ({ count, position }) => {
          const content = document.createElement("div");
          content.className = "finder-cluster-count";
          content.textContent = String(count);
          return new maps.AdvancedMarkerElement({
            position,
            content,
            title: `Show ${count} stations`,
            zIndex: 100 + count,
          });
        },
      },
    });
    const points: typeof enteredPoints = JSON.parse(pointsKey);
    points.forEach((p) =>
      addMarker(
        p.latitude,
        p.longitude,
        p.label,
        p.label === "A" ? "Starting point" : "Destination",
      ),
    );
    const routePoints = route?.found
      ? route.road_route?.geometry?.coordinates || [
          [route.origin.longitude, route.origin.latitude],
          ...route.stations.map((s: Station) => [s.longitude, s.latitude]),
          [route.destination.longitude, route.destination.latitude],
        ]
      : [];
    let line: any = null;
    if (routePoints.length > 1)
      line = new maps.Polyline({
        map: m,
        path: routePoints.map(([lng, lat]: number[]) => ({ lat, lng })),
        strokeColor: "#38cfae",
        strokeWeight: 5,
        strokeOpacity: 0.95,
      });
    let boundsPoints = routePoints.length
      ? routePoints
      : points.length
        ? points.map((p) => [p.longitude, p.latitude])
        : stations.map((s) => [s.longitude, s.latitude]);
    if (!points.length && !route?.found && region && REGION_BOUNDS[region])
      boundsPoints = REGION_BOUNDS[region];
    if (boundsPoints.length) {
      const bounds = new maps.LatLngBounds();
      boundsPoints.forEach(([lng, lat]: number[]) =>
        bounds.extend({ lat, lng }),
      );
      m.fitBounds(
        bounds,
        m.getDiv().clientHeight < 500
          ? { top: 95, bottom: 55, left: 30, right: 30 }
          : { top: 160, bottom: 80, left: 65, right: 65 },
      );
      listeners.push(
        m.addListener("idle", () => {
          if (m.getZoom() > 16) m.setZoom(16);
        }),
      );
    }
    return () => {
      listeners.forEach((l) => l.remove());
      clusterer.setMap(null);
      clusterer.clearMarkers();
      overlays.forEach((o) => {
        o.map = null;
      });
      line?.setMap(null);
    };
  }, [ready, stations, route, region, pointsKey, select]);
  useEffect(() => {
    if (!ready || !map.current) return;
    const station = stations.find((s) => s.station_id === selected);
    if (station) {
      map.current.panTo({ lat: station.latitude, lng: station.longitude });
      map.current.setZoom(14);
    }
  }, [selected, stations, ready]);
  useEffect(() => {
    if (map.current)
      map.current.setOptions({
        draggableCursor: onPointPick ? "crosshair" : null,
      });
  }, [onPointPick, ready]);
  return (
    <div className="map-shell finder-google-map">
      <div
        ref={element}
        className="map-canvas"
        aria-label="Google Maps with imported charging stations"
      />
      {error ? (
        <div className="finder-google-error" role="alert">
          <strong>Google Maps is unavailable</strong>
          <p>{error}</p>
          <p>Your station list and navigation buttons are still available.</p>
        </div>
      ) : !ready ? (
        <div className="finder-google-error" role="status">
          Loading Google Maps…
        </div>
      ) : null}
      {ready && !error && (
        <div className="map-tools">
          <button
            aria-label="Fit imported stations"
            onClick={() => {
              const b = new sdk.current.LatLngBounds();
              stations.forEach((s) =>
                b.extend({ lat: s.latitude, lng: s.longitude }),
              );
              if (stations.length) map.current.fitBounds(b, 65);
            }}
          >
            <LocateFixed size={18} />
          </button>
        </div>
      )}
    </div>
  );
}
