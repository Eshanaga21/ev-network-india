import { lazy, Suspense, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Zap } from "lucide-react";
import { request } from "./api";
import type { Dataset } from "./types";
import { Loading, Notice } from "./shared";
import Onboarding from "./Onboarding";
const Console = lazy(() => import("./Console"));
const StationFinder = lazy(() => import("./StationFinder"));
export default function App() {
  const [research, setResearch] = useState(false);
  const dataset = useQuery<Dataset>({
    queryKey: ["dataset"],
    queryFn: () => request("dataset"),
  });
  if (dataset.isPending)
    return (
      <div className="startup">
        <Zap size={32} />
        <Loading text="Opening your local workspace…" />
      </div>
    );
  if (dataset.error)
    return (
      <div className="startup">
        <h1>Connect the local backend</h1>
        <Notice error>{dataset.error.message}</Notice>
        <p>Start FastAPI on 127.0.0.1:8001, then retry.</p>
        <button className="primary" onClick={() => dataset.refetch()}>
          Retry connection
        </button>
      </div>
    );
  return dataset.data.loaded ? (
    <Suspense fallback={<Loading text="Opening the map console…" />}>
      {research ? (
        <Console dataset={dataset.data} onBack={() => setResearch(false)} />
      ) : (
        <StationFinder
          dataset={dataset.data}
          onResearch={() => setResearch(true)}
        />
      )}
    </Suspense>
  ) : (
    <Onboarding />
  );
}
