"""Source-backed vehicle catalogue and conservative, explicit charging estimates."""

import json
import math
import re
from pathlib import Path

CATALOG_PATH = Path(__file__).resolve().parents[1] / "data/vehicles/catalog.json"
CONNECTORS = {"CCS2", "Type2", "CHAdeMO", "GB/T DC", "GB/T AC", "CCS1", "Type1", "NACS"}
DC_CONNECTORS = {"CCS2", "CHAdeMO", "GB/T DC", "CCS1"}


def catalog():
    return json.loads(CATALOG_PATH.read_text())


def resolve(selection):
    if selection.custom:
        return {
            "id": None,
            "manufacturer": "Custom",
            "model": selection.custom.name,
            "variant": "Owner-entered profile",
            **selection.custom.model_dump(),
            "connector_coverage_complete": True,
            "charging_curve": None,
            "source": None,
            "certified_range_km": None,
        }
    match = next((v for v in catalog()["vehicles"] if v["id"] == selection.catalog_id), None)
    if not match:
        raise ValueError(
            "This vehicle edition is unavailable. Select another vehicle or a custom profile."
        )
    return match


def connectors(value):
    """Return known types and whether the source contains unresolved tokens."""
    if not value:
        return set(), True
    aliases = {
        "ccscombo2": "CCS2",
        "ccstype2": "CCS2",
        "ccs2": "CCS2",
        "type2": "Type2",
        "mennekes": "Type2",
        "chademo": "CHAdeMO",
        "gb/tdc": "GB/T DC",
        "gb/tac": "GB/T AC",
        "ccs1": "CCS1",
        "ccscombo1": "CCS1",
        "type1": "Type1",
        "j1772": "Type1",
        "nacs": "NACS",
    }
    tokens = value if isinstance(value, list) else re.split(r"[,;|+]", str(value))
    known, unresolved = set(), False
    for token in tokens:
        key = re.sub(r"[\s_\-()]", "", token).lower()
        if key in aliases:
            known.add(aliases[key])
        else:
            unresolved = True
    return known, unresolved


def compatibility(profile, station):
    vehicle, incomplete = connectors(profile.get("connector_types"))
    station_types, missing = connectors(station.get("connector_type"))
    common = vehicle & station_types
    if common:
        return {
            "status": "compatible",
            "connectors": sorted(common),
            "explanation": "Matching documented connector type; availability and working condition still need checking.",
        }
    if (
        vehicle
        and station_types
        and not incomplete
        and not missing
        and profile.get("connector_coverage_complete")
    ):
        return {
            "status": "incompatible",
            "connectors": [],
            "explanation": "No shared connector in the specified vehicle and station connector lists. No adapter assumed.",
        }
    return {
        "status": "unknown",
        "connectors": [],
        "explanation": "Compatibility unknown: station connector or complete vehicle connector information is missing.",
    }


def permitted(profile, station, allow_unknown=True):
    status = compatibility(profile, station)["status"]
    return status == "compatible" or (allow_unknown and status == "unknown")


def finite_positive(value):
    return (
        isinstance(value, (float, int))
        and not isinstance(value, bool)
        and math.isfinite(value)
        and value > 0
    )


def charge_session(profile, station, start_soc, end_soc, vehicle):
    match = compatibility(profile, station)
    delta = vehicle.capacity_kwh * (end_soc - start_soc) / 100
    grid = delta / vehicle.charge_efficiency
    station_power = station.get("charging_power_kw")
    possible = []
    station_types, unresolved = connectors(station.get("connector_type"))
    # A single station power field cannot assign ratings to different connector outputs.
    usable_rating = len(station_types) == 1 and not unresolved
    for connector in match["connectors"]:
        if not usable_rating or connector == "NACS":
            continue
        limit = profile.get(
            "max_dc_charge_kw" if connector in DC_CONNECTORS else "max_ac_charge_kw"
        )
        if finite_positive(limit) and finite_positive(station_power):
            possible.append((min(limit, station_power), connector, limit))
    power, connector, vehicle_limit = max(possible, default=(None, None, None))
    minutes, basis = (
        None,
        "Unknown: requires matching connector, station power and vehicle charging limit.",
    )
    curve = profile.get("charging_curve")
    if power is not None:
        # A source-backed curve is a list of contiguous SOC bands of average grid-input kW.
        if curve and curve.get("source"):
            bands = curve.get("bands", [])
            cursor, elapsed = start_soc, 0.0
            for band in bands:
                low, high, kw = band["from_soc"], band["to_soc"], band["power_kw"]
                if high <= cursor or low > cursor or not finite_positive(kw):
                    continue
                end = min(end_soc, high)
                elapsed += (
                    vehicle.capacity_kwh
                    * (end - cursor)
                    / 100
                    / (min(power, kw) * vehicle.charge_efficiency)
                    * 60
                )
                cursor = end
                if cursor >= end_soc:
                    break
            if cursor >= end_soc:
                minutes, basis = (
                    elapsed,
                    "Documented SOC-band charging model, capped by vehicle and charger limits.",
                )
            else:
                basis = "Unknown: documented charging model does not cover the entire requested session."
        else:
            minutes = grid / (power * vehicle.average_charge_fraction) * 60
            basis = "User planning assumption: average input power = lower vehicle/charger limit × average-charge fraction. No documented taper curve; peak power is not assumed sustained."
    rate = station.get("tariff_inr_per_kwh")
    tariff_known = (
        isinstance(rate, (int, float))
        and not isinstance(rate, bool)
        and math.isfinite(rate)
        and rate >= 0
    )
    return {
        "compatibility": match,
        "connector": connector,
        "vehicle_limit_kw": vehicle_limit,
        "charger_limit_kw": station_power if finite_positive(station_power) else None,
        "power_ceiling_kw": power,
        "charge_time_min": minutes,
        "charging_basis": basis,
        "energy_cost_inr": grid * rate if tariff_known else None,
        "tariff_inr_per_kwh": rate if tariff_known else None,
        "cost_basis": "Energy only: modeled input kWh × supplied tariff; session/parking fees excluded. Operator meter basis may differ.",
        "conditional": match["status"] != "compatible",
    }
