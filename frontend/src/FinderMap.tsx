import { lazy, Suspense } from "react";
import { useQuery } from "@tanstack/react-query";
import MapView from "./MapView";
import { request } from "./api";
const GoogleMapView = lazy(() => import("./GoogleMapView"));
export default function FinderMap(props: React.ComponentProps<typeof MapView>) {
  const config = useQuery({
    queryKey: ["maps-config"],
    queryFn: () => request("maps/config"),
    staleTime: 60000,
    retry: false,
  });
  if (config.isPending)
    return (
      <div role="status" className="finder-google-error">
        Opening your map…
      </div>
    );
  if (config.isError)
    return (
      <div role="alert" className="finder-google-error">
        Map settings are unavailable. Reload to try again. Your station list is
        still available.
      </div>
    );
  if (!config.data?.browser_key) return <MapView {...props} />;
  return (
    <Suspense
      fallback={
        <div role="status" className="finder-google-error">
          Loading Google Maps…
        </div>
      }
    >
      <GoogleMapView
        config={config.data}
        stations={props.stations}
        route={props.route}
        region={props.region || ""}
        enteredPoints={props.enteredPoints || []}
        onPointPick={props.onPointPick}
      />
    </Suspense>
  );
}
