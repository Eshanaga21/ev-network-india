from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid", allow_inf_nan=False)


class GraphSettings(StrictModel):
    method: Literal["radius", "knn"] = "radius"
    radius_km: float = Field(default=25, gt=0, le=2000)
    k: int = Field(default=3, ge=1, le=25)
    speed_kmh: float = Field(default=45, gt=0, le=150)


class Context(StrictModel):
    graph: GraphSettings = Field(default_factory=GraphSettings)
    state: str | None = None
    city: str | None = None
    search: str = ""


class Point(StrictModel):
    station_id: str | None = None
    label: str | None = Field(default=None, max_length=300)
    accuracy_m: float | None = Field(default=None, ge=0)
    latitude: float | None = Field(default=None, ge=6, le=38)
    longitude: float | None = Field(default=None, ge=68, le=98)

    @model_validator(mode="after")
    def valid_point(self):
        if not self.station_id and (self.latitude is None or self.longitude is None):
            raise ValueError("Select a real station or enter both coordinates.")
        return self


class Vehicle(StrictModel):
    capacity_kwh: float = Field(default=50, gt=0, le=500)
    initial_soc: float = Field(default=80, ge=0, le=100)
    consumption_kwh_100km: float = Field(default=16, gt=0, le=100)
    reserve_soc: float = Field(default=10, ge=0, lt=100)
    target_soc: float = Field(default=90, gt=0, le=100)
    assumed_charge_power_kw: float = Field(default=30, gt=0, le=1000)
    charge_efficiency: float = Field(default=0.9, gt=0, le=1)
    max_stops: int = Field(default=5, ge=0, le=100)

    @model_validator(mode="after")
    def valid_target(self):
        if self.target_soc <= self.reserve_soc:
            raise ValueError("Target SOC must exceed reserve SOC.")
        return self


class RouteRequest(Context):
    origin: Point
    destination: Point
    algorithm: Literal["dijkstra", "astar"] = "dijkstra"
    vehicle: Vehicle = Field(default_factory=Vehicle)


class RemovalRequest(Context):
    station_id: str
    reference_id: str | None = None


class AccessibilityRequest(Context):
    radius_km: float = Field(default=25, gt=0, le=1000)
    weights: dict[str, float] = Field(
        default_factory=lambda: {"distance": 35, "density": 35, "connectivity": 30}
    )

    @model_validator(mode="after")
    def valid_weights(self):
        allowed = {"distance", "density", "connectivity", "availability", "ports", "power"}
        if set(self.weights) - allowed or any(v < 0 for v in self.weights.values()):
            raise ValueError("Use supported, nonnegative accessibility weights.")
        if abs(sum(self.weights.values()) - 100) > 0.001:
            raise ValueError("Accessibility weights must total 100%.")
        return self


class ClusterRequest(Context):
    radius_km: float = Field(default=15, gt=0, le=500)
    min_samples: int = Field(default=3, ge=2, le=100)


class ExpansionRequest(Context):
    coverage_radius_km: float = Field(default=25, gt=0, le=500)


class ComparisonRequest(Context):
    station_ids: list[str] = Field(min_length=2, max_length=4)


class ImportRequest(StrictModel):
    preview_id: str


class Scenario(StrictModel):
    name: str = Field(min_length=1, max_length=100)
    settings: dict


class ReportRequest(Context):
    route: RouteRequest | None = None
    outage: RemovalRequest | None = None
    accessibility: AccessibilityRequest = Field(default_factory=AccessibilityRequest)
    expansion: ExpansionRequest = Field(default_factory=ExpansionRequest)


class PlaceSearchRequest(StrictModel):
    query: str = Field(min_length=2, max_length=200)

    @model_validator(mode="after")
    def meaningful_query(self):
        self.query = self.query.strip()
        if len(self.query) < 2:
            raise ValueError("Enter at least two characters of a place or address.")
        return self
