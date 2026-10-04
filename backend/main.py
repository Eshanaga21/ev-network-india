import html
import io
import json
import platform
import threading
import time
import uuid
from collections import OrderedDict
from importlib.metadata import version

import httpx
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, StreamingResponse

from backend import engine, gemini
from backend.ingestion import FIELDS, normalize
from backend.models import (
    AccessibilityRequest,
    ClusterRequest,
    ComparisonRequest,
    Context,
    ExpansionRequest,
    ImportRequest,
    PlaceSearchRequest,
    RemovalRequest,
    ReportRequest,
    RouteRequest,
    Scenario,
)
from backend.providers import get_geocoder, get_provider
from backend.regions import canonical_state, regional_dataset
from backend.store import Store
from backend.trips import road_trip

SOURCE_URL = "https://e-amrit.niti.gov.in/getChargingStation"


def create_app(data_dir=None):
    app = FastAPI(title="EV Network Intelligence — India", version="1.0.0")
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["http://127.0.0.1:5173", "http://localhost:5173", "http://127.0.0.1:4173"],
        allow_methods=["GET", "POST", "DELETE"],
        allow_headers=["Content-Type"],
    )
    store = Store(data_dir)
    app.state.store = store
    previews = {}
    graph_cache = OrderedDict()
    cache_lock = threading.RLock()

    @app.exception_handler(ValueError)
    async def value_error(_, exc):
        from fastapi.responses import JSONResponse

        return JSONResponse(status_code=422, content={"detail": str(exc)})

    def active():
        dataset = store.load()
        if not dataset:
            raise HTTPException(
                409, "No dataset loaded. Import and validate real station data first."
            )
        return regional_dataset(dataset)

    def context(request):
        dataset = active()
        stations = [
            s
            for s in dataset["stations"]
            if (not request.state or s["state"] == canonical_state(request.state))
            and (not request.city or s["city"] == request.city)
            and (
                not request.search
                or request.search.lower()
                in " ".join(
                    str(s.get(k) or "") for k in ("station_name", "city", "state", "operator")
                ).lower()
            )
        ]
        key = (
            dataset["metadata"]["snapshot_id"],
            request.graph.model_dump_json(),
            request.state,
            request.city,
            request.search,
        )
        with cache_lock:
            if key not in graph_cache:
                graph_cache[key] = engine.build_graph(stations, request.graph)
                if len(graph_cache) > 12:
                    graph_cache.popitem(last=False)
            graph = graph_cache[key]
        audit = {
            "snapshot_id": dataset["metadata"]["snapshot_id"],
            "source_name": dataset["metadata"]["source_name"],
            "source_url": dataset["metadata"]["source_url"],
            "imported_at": dataset["metadata"]["imported_at"],
            "raw_sha256": dataset["metadata"]["raw_sha256"],
            "application_version": "1.0.0",
            "algorithm_versions": {
                "python": platform.python_version(),
                **{package: version(package) for package in ("networkx", "numpy", "scikit-learn")},
            },
            "regional_scope": dataset["metadata"]["regional_scope"],
            "regional_records": dataset["metadata"]["regional_records"],
            "scope_coordinate_check": dataset["metadata"]["scope_coordinate_check"],
            "geographic_conflicts_excluded": dataset["metadata"]["geographic_conflicts_excluded"],
            "identity_policy": dataset["metadata"].get("identity_policy", "Source identifiers"),
            "filters": {"state": request.state, "city": request.city, "search": request.search},
            "graph": request.graph.model_dump(),
            "interpretation": "Observed station fields; calculated graph results; user-configured model estimates. Geographic edges are not roads.",
        }
        return dataset, graph, audit

    def preview(content, filename, mapping, source_name, source_url, generate_missing_ids=False):
        result = normalize(
            content, filename, mapping, source_name, source_url, generate_missing_ids
        )
        token = uuid.uuid4().hex
        # Expire previews and bound memory. Import must use the reviewed exact payload.
        for key in list(previews):
            if time.monotonic() - previews[key][2] > 1800:
                del previews[key]
        if len(previews) >= 10:
            del previews[next(iter(previews))]
        previews[token] = (result, content, time.monotonic())
        return {**result, "preview_id": token}

    @app.get("/api/health")
    def health():
        return {
            "status": "ok",
            "road_provider": "OSRM" if get_provider() else None,
            "geocoding_provider": "Photon / OpenStreetMap" if get_geocoder() else None,
            "gemini_configured": gemini.settings()[0],
            "gemini_model": gemini.settings()[1] if gemini.settings()[0] else None,
        }

    @app.post("/api/places/search")
    def search_places(request: PlaceSearchRequest):
        provider = get_geocoder()
        if not provider:
            raise HTTPException(503, "Place search is disabled. Enter latitude, longitude instead.")
        try:
            return provider.search(request.query.strip())
        except (httpx.HTTPError, ValueError, KeyError, TypeError):
            raise HTTPException(
                502,
                "Place search is temporarily unavailable. Try again or enter latitude, longitude.",
            ) from None

    def calculate_trip(request):
        _, graph, audit = context(request)
        provider = get_provider()
        warning = None
        if provider:
            try:
                result = road_trip(graph, request, provider)
            except (httpx.HTTPError, ValueError, KeyError, TypeError):
                warning = "Road service is unavailable for this trip. Showing a geographic model estimate, including start/end connector distances."
            else:
                return {
                    **result,
                    "audit": {
                        **audit,
                        "origin": request.origin.model_dump(),
                        "destination": request.destination.model_dump(),
                        "vehicle": request.vehicle.model_dump(),
                        "route_mode": "road",
                        "provider": "OSRM",
                        "charging_plan": result["charging_plan"],
                    },
                }
        result = engine.route(graph, request)
        if warning:
            result["road_error"] = warning
        result["route_mode"] = "geographic"
        for key in ("origin", "destination"):
            point = getattr(request, key)
            endpoint = result[key]
            endpoint["label"] = point.label or (
                endpoint["station_name"]
                if point.station_id
                else f"{point.latitude:.5f}, {point.longitude:.5f}"
            )
        return {
            **result,
            "audit": {
                **audit,
                "origin": request.origin.model_dump(),
                "destination": request.destination.model_dump(),
                "vehicle": request.vehicle.model_dump(),
                "route_mode": "geographic",
            },
        }

    @app.post("/api/trip")
    def trip(request: RouteRequest):
        return calculate_trip(request)

    @app.post("/api/trip/explain")
    def explain_trip(request: RouteRequest):
        try:
            return gemini.explain(calculate_trip(request))
        except (httpx.HTTPError, ValueError):
            raise HTTPException(
                502,
                "Gemini could not explain this trip. Check API-key permissions, model access or project quota; the trip estimate remains available.",
            ) from None

    @app.get("/api/dataset")
    def dataset():
        loaded = store.load()
        if loaded:
            loaded = regional_dataset(loaded)
        return {
            "loaded": bool(loaded),
            "metadata": loaded["metadata"] if loaded else None,
            "stations": loaded["stations"] if loaded else [],
        }

    @app.get("/api/schema")
    def schema():
        return StreamingResponse(
            io.StringIO(",".join(FIELDS) + "\n"),
            media_type="text/csv",
            headers={"Content-Disposition": 'attachment; filename="station-schema.csv"'},
        )

    @app.post("/api/import/preview")
    async def import_preview(
        file: UploadFile = File(...),
        mapping: str = Form("{}"),
        source_name: str = Form("User upload"),
        source_url: str | None = Form(None),
        generate_missing_ids: bool = Form(False),
    ):
        content = await file.read(15 * 1024 * 1024 + 1)
        try:
            mapping_data = json.loads(mapping)
            if not isinstance(mapping_data, dict):
                raise ValueError("Mapping must be an object.")
            return preview(
                content,
                file.filename or "upload",
                mapping_data,
                source_name,
                source_url,
                generate_missing_ids,
            )
        except (json.JSONDecodeError, UnicodeDecodeError) as exc:
            raise ValueError("File or mapping is not valid UTF-8 CSV/JSON.") from exc

    @app.post("/api/import/refresh")
    def refresh():
        try:
            response = httpx.get(SOURCE_URL, timeout=20, follow_redirects=True)
            response.raise_for_status()
            return preview(
                response.content, "eamrit-refresh.json", {}, "E-Amrit / NITI Aayog", SOURCE_URL
            )
        except (httpx.HTTPError, ValueError) as exc:
            raise HTTPException(
                502,
                "E-Amrit refresh unavailable. No records substituted. Upload a documented CSV/JSON snapshot.",
            ) from exc

    @app.post("/api/import/commit")
    def import_commit(request: ImportRequest):
        value = previews.get(request.preview_id)
        if not value or time.monotonic() - value[2] > 1800:
            raise HTTPException(404, "Preview expired. Validate the file again.")
        result, content, _ = value
        if not result["stations"]:
            raise ValueError("No valid station records; import cannot proceed.")
        saved = store.save(result, content)
        del previews[request.preview_id]
        return {"loaded": True, **saved}

    @app.delete("/api/dataset")
    def unload():
        store.reset()
        return {"loaded": False, "note": "Snapshot files retained; active dataset unloaded."}

    @app.post("/api/analysis")
    def analysis(request: Context):
        _, graph, audit = context(request)
        return {**engine.analyze(graph), "audit": audit}

    @app.post("/api/route")
    def route(request: RouteRequest):
        _, graph, audit = context(request)
        result = engine.route(graph, request)
        provider = get_provider()
        if result["found"] and provider and len(result["path"]) > 1:
            try:
                result["road_route"] = provider.route(
                    [
                        (result["origin"]["latitude"], result["origin"]["longitude"]),
                        *[(s["latitude"], s["longitude"]) for s in result["stations"]],
                        (result["destination"]["latitude"], result["destination"]["longitude"]),
                    ]
                )
            except (httpx.HTTPError, ValueError):
                result["road_error"] = (
                    "Configured road provider failed; geographic route retained and labeled."
                )
        return {
            **result,
            "audit": {
                **audit,
                "vehicle": request.vehicle.model_dump(),
                "origin": request.origin.model_dump(),
                "destination": request.destination.model_dump(),
                "algorithm": request.algorithm,
            },
        }

    @app.post("/api/resilience")
    def resilience(request: RemovalRequest):
        _, graph, audit = context(request)
        return {
            **engine.resilience(graph, request.station_id, request.reference_id),
            "audit": {
                **audit,
                "removed_station": request.station_id,
                "reference_id": request.reference_id,
            },
        }

    @app.post("/api/accessibility")
    def accessibility(request: AccessibilityRequest):
        dataset, graph, audit = context(request)
        return {
            **engine.accessibility(graph, request, dataset["metadata"]),
            "audit": {**audit, "weights": request.weights, "radius_km": request.radius_km},
        }

    @app.post("/api/expansion")
    def expansion(request: ExpansionRequest):
        _, graph, audit = context(request)
        return {
            **engine.expansion(graph, request),
            "audit": {**audit, "coverage_radius_km": request.coverage_radius_km},
        }

    @app.post("/api/clusters")
    def clusters(request: ClusterRequest):
        _, graph, audit = context(request)
        return {
            **engine.clusters(graph, request),
            "audit": {**audit, "radius_km": request.radius_km, "min_samples": request.min_samples},
        }

    @app.post("/api/comparison")
    def comparison(request: ComparisonRequest):
        _, graph, audit = context(request)
        if len(set(request.station_ids)) != len(request.station_ids):
            raise ValueError("Choose 2–4 distinct stations.")
        if any(s not in graph for s in request.station_ids):
            raise ValueError("Comparison stations must be in the current filtered dataset.")
        metrics = engine.analyze(graph)["stations"]
        records = []
        for station in metrics:
            if station["station_id"] in request.station_ids:
                impact = engine.resilience(graph, station["station_id"])
                records.append(
                    {
                        **station,
                        "disconnected_on_removal": len(impact["disconnected_stations"]),
                        "components_after_removal": impact["after"]["components"],
                    }
                )
        return {
            "stations": records,
            "audit": {**audit, "station_ids": request.station_ids},
            "label": "Observed fields and calculated graph comparison; completeness is not reliability.",
        }

    @app.get("/api/scenarios")
    def scenarios():
        return store.scenarios()

    @app.post("/api/scenarios")
    def save_scenario(request: Scenario):
        if len(json.dumps(request.settings)) > 100_000:
            raise ValueError("Scenario settings exceed local size limit.")
        active()
        return store.save_scenario(request.name, request.settings)

    @app.delete("/api/scenarios/{sid}")
    def delete_scenario(sid: str):
        store.delete_scenario(sid)
        return {"deleted": True}

    @app.post("/api/scenarios/{sid}/load")
    def load_scenario(sid: str):
        scenario = next((s for s in store.scenarios() if s["id"] == sid), None)
        if not scenario:
            raise HTTPException(404, "Scenario not found.")
        store.activate(scenario["snapshot_id"])
        return scenario

    @app.post("/api/report", response_class=HTMLResponse)
    def report(request: ReportRequest):
        dataset, graph, audit = context(request)
        metrics = engine.analyze(graph)
        blocks = {
            "Dataset source and quality — observed": dataset["metadata"],
            "Reproducibility": audit,
            "Graph results — calculated": metrics["summary"],
            "Centrality ranking — calculated": sorted(
                metrics["stations"], key=lambda s: -s["betweenness_centrality"]
            )[:15],
            "Route and battery model": engine.route(graph, request.route)
            if request.route
            else "No selected route",
            "Modeled station outage": engine.resilience(
                graph, request.outage.station_id, request.outage.reference_id
            )
            if request.outage
            else "No selected outage",
            "Relative accessibility — calculated": engine.accessibility(
                graph,
                request.accessibility.model_copy(
                    update={
                        "graph": request.graph,
                        "state": request.state,
                        "city": request.city,
                        "search": request.search,
                    }
                ),
                dataset["metadata"],
            ),
            "Expansion candidates — modeled": engine.expansion(
                graph,
                request.expansion.model_copy(
                    update={
                        "graph": request.graph,
                        "state": request.state,
                        "city": request.city,
                        "search": request.search,
                    }
                ),
            ),
            "Methodology and limitations": "G=(V,E). Nodes are imported stations. Radius edges join within the entered Haversine distance; k-NN uses the undirected union of nearest-neighbor selections. No connectivity is forced. Dijkstra and A* minimize geographic distance. Speed and battery assumptions are user inputs. Accessibility is relative to filtered records. Expansion uses spherical MST midpoints. No live occupancy, demand, land, population, grid, traffic, road or official-score claims. Coordinate validation uses an envelope, not ground verification.",
        }
        body = "".join(
            f"<section><h2>{html.escape(title)}</h2><pre>{html.escape(json.dumps(value, indent=2, ensure_ascii=False))}</pre></section>"
            for title, value in blocks.items()
        )
        return HTMLResponse(
            '<!doctype html><html lang="en"><meta charset="utf-8"><title>EV Network Intelligence — Academic Report</title><style>body{font:15px system-ui;max-width:1000px;margin:40px auto;color:#142536;padding:24px}h1{font-size:32px}h2{font-size:20px;border-bottom:1px solid #aaa;padding-bottom:12px}pre{white-space:pre-wrap;overflow-wrap:anywhere;font:12px monospace}section{margin-bottom:40px}@media print{body{margin:0}section{break-inside:auto}h2{break-after:avoid}}</style><h1>EV Network Intelligence — India</h1><p>Academic analysis report • Observations, calculations and model estimates are labeled.</p><button onclick="window.print()">Print / Save as PDF</button>'
            + body
            + "</html>",
            headers={"Content-Disposition": 'attachment; filename="ev-academic-report.html"'},
        )

    return app


app = create_app()
