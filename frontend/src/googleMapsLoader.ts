let loading: Promise<any> | null = null;
export function loadGoogleMaps(browserKey: string): Promise<any> {
  if (loading) return loading;
  loading = new Promise((resolve, reject) => {
    const globals = window as any;
    const script = document.createElement("script");
    const fail = () => {
      loading = null;
      script.remove();
      reject(
        new Error(
          "Google Maps could not load. Check the browser key, website restrictions, billing and Maps JavaScript API.",
        ),
      );
    };
    const timer = window.setTimeout(fail, 20000);
    globals.evGoogleMapsReady = () => {
      window.clearTimeout(timer);
      resolve(globals.google.maps);
    };
    globals.gm_authFailure = () => {
      window.clearTimeout(timer);
      fail();
      window.dispatchEvent(new Event("ev-google-auth-error"));
    };
    script.async = true;
    script.onerror = () => {
      window.clearTimeout(timer);
      fail();
    };
    const params = new URLSearchParams({
      key: browserKey,
      loading: "async",
      callback: "evGoogleMapsReady",
      libraries: "marker",
      v: "weekly",
      region: "IN",
      language: "en",
    });
    script.src = `https://maps.googleapis.com/maps/api/js?${params}`;
    document.head.appendChild(script);
  });
  return loading;
}
