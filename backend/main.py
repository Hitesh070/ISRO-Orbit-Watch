"""
OrbitGuard FastAPI Server Entrypoint
====================================
High-performance REST API delivering real-time satellite orbital propagation,
space debris risk calculations, conjunction warnings, ground station passes, and analytics.
"""

import json
import logging
import os
import secrets
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, Optional

from fastapi import FastAPI, Header, HTTPException, Query, status
from fastapi.middleware.cors import CORSMiddleware

try:  # load .env for local development (optional dependency on Vercel)
    from dotenv import load_dotenv

    load_dotenv()
except ImportError:  # pragma: no cover
    pass

from backend.conjunction import conjunction_detector
from backend.pass_predictor import FAMOUS_GROUND_STATIONS, pass_predictor
from backend.propagator import propagator
from backend.risk_engine import risk_engine
from backend.tle_fetcher import tle_fetcher

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger("orbitguard.api")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan manager: starts scheduler on boot, cleans up on shutdown."""
    logger.info("Initializing OrbitGuard backend service...")
    try:
        # Start background TLE refresh every 6 hours
        # Background threads cannot survive on serverless; data refresh runs in GitHub Actions there.
        if not os.getenv("VERCEL"):
            refresh_hours = int(os.getenv("DATA_REFRESH_HOURS", "6"))
            tle_fetcher.start_scheduler(interval_hours=refresh_hours)
    except Exception as exc:
        logger.warning(f"Could not start TLE scheduler: {exc}")

    yield

    logger.info("Shutting down OrbitGuard backend service...")
    try:
        tle_fetcher.stop_scheduler()
    except Exception as exc:
        logger.warning(f"Error shutting down scheduler: {exc}")


app = FastAPI(
    title="OrbitGuard API",
    description="Real-Time Satellite Orbit Tracker & Space Debris Risk Dashboard REST API",
    version="4.2.0",
    lifespan=lifespan,
)

# Enable CORS with configurable allow-list
cors_origins_env = os.getenv("CORS_ORIGINS", "*")
allowed_origins = [o.strip() for o in cors_origins_env.split(",") if o.strip()] or ["*"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins if "*" not in allowed_origins else ["*"],
    allow_credentials=False,  # wildcard origins + credentials is invalid/unsafe
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)


@app.get("/api/health")
def health_check():
    """
    Service health check endpoint.
    Reports operational status, current UTC time, catalog metadata provenance, and system diagnostics.
    """
    meta_path = Path(__file__).resolve().parent / "data" / "meta.json"
    pipeline_meta = {}
    if meta_path.exists():
        try:
            with open(meta_path, "r", encoding="utf-8") as f:
                pipeline_meta = json.load(f)
        except Exception:
            pass

    return {
        "status": "healthy",
        "service": "OrbitGuard SSA API",
        "version": "4.2.0",
        "timestamp_utc": datetime.now(timezone.utc).isoformat(),
        "pipeline_metadata": pipeline_meta,
    }


@app.get("/")
def root():
    """Service health and capability manifest."""
    return {
        "service": "OrbitGuard API",
        "status": "OPERATIONAL",
        "version": "4.2.0",
        "description": "Real-Time Satellite Orbit Tracker & Space Debris Risk Dashboard",
        "endpoints": [
            "/api/satellites",
            "/api/satellite/{norad_id}",
            "/api/debris",
            "/api/risk",
            "/api/risk/{norad_id}",
            "/api/conjunctions",
            "/api/passes",
            "/api/analytics",
            "/api/ground-stations",
        ],
    }


@app.get("/api/satellites")
def get_satellites(
    limit: Optional[int] = Query(default=150, description="Maximum number of satellites to return"),
    regime: Optional[str] = Query(default=None, description="Filter by orbital regime: LEO, MEO, GEO, HEO"),
    country: Optional[str] = Query(default=None, description="Filter by country or operating agency"),
    search: Optional[str] = Query(default=None, description="Search query by name or NORAD ID"),
):
    """
    Returns real-time propagated positions (lat, lon, alt, velocity) and orbital elements
    for operational satellites, annotated with real-time risk scores.
    """
    effective_limit = limit if (limit and limit > 0) else 150
    active_data = propagator.propagate_catalog(tle_fetcher.active_file, limit=effective_limit)
    debris_data = propagator.propagate_catalog(tle_fetcher.debris_file, limit=40)

    # Attach risk scores to active satellites
    risk_summary = risk_engine.compute_all_risks(active_data, debris_data)
    risk_map = risk_summary["all_risks"]

    results = []
    for sat in active_data:
        nid = sat["norad_id"]
        risk_info = risk_map.get(nid, {})
        sat_copy = dict(sat)
        sat_copy["risk_score"] = risk_info.get("risk_score", 15.0)
        sat_copy["risk_level"] = risk_info.get("risk_level", "SAFE")
        sat_copy["status_color"] = risk_info.get("status_color", "green")
        sat_copy["collision_probability"] = risk_info.get("collision_probability", 0.0001)

        # Filters
        if regime and sat_copy["regime"].upper() != regime.upper():
            continue
        if country and country.lower() not in sat_copy["country"].lower():
            continue
        if search:
            q = search.lower().strip()
            if q not in str(nid) and q not in sat_copy["name"].lower():
                continue

        results.append(sat_copy)

    return {
        "count": len(results),
        "total_active": len(active_data),
        "satellites": results,
    }


@app.get("/api/satellite/{norad_id}")
def get_satellite_detail(norad_id: int):
    """
    Returns full telemetry, current Cartesian position, and 3D orbit trajectory path
    points for a single satellite.
    """
    # Search in active satellites first
    active_sats = propagator.parse_tle_file(tle_fetcher.active_file)
    debris_sats = propagator.parse_tle_file(tle_fetcher.debris_file)
    all_sats = active_sats + debris_sats

    target_sat = None
    for sat in all_sats:
        if int(sat.model.satnum) == norad_id:
            target_sat = sat
            break

    if not target_sat:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Satellite with NORAD ID {norad_id} not found in current catalog.",
        )

    sat_info = propagator.propagate_satellite(target_sat)
    if not sat_info:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to propagate satellite position.",
        )

    # Compute orbit trajectory points (200 points along one revolution)
    orbit_path = propagator.compute_orbit_path(target_sat, num_points=180)

    # Compute risk profile
    debris_catalog = propagator.propagate_catalog(tle_fetcher.debris_file, limit=40)
    risk_info = risk_engine.calculate_satellite_risk(sat_info, debris_catalog)

    return {
        **sat_info,
        "risk": risk_info,
        "orbit_path": orbit_path,
    }


@app.get("/api/debris")
def get_debris(
    limit: Optional[int] = Query(default=None, description="Limit count of debris pieces"),
):
    """
    Returns real-time orbital positions and elements for cataloged space debris pieces
    and spent rocket stages.
    """
    debris_data = propagator.propagate_catalog(tle_fetcher.debris_file, limit=limit)
    return {
        "count": len(debris_data),
        "debris": debris_data,
    }


@app.get("/api/risk")
def get_risk_overview():
    """
    Returns risk scores for all active satellites, top 10 highest-risk satellites,
    orbital shell breakdown (LEO, MEO, GEO), and altitude x inclination risk heatmap.
    """
    active_data = propagator.propagate_catalog(tle_fetcher.active_file, limit=100)
    debris_data = propagator.propagate_catalog(tle_fetcher.debris_file, limit=50)

    summary = risk_engine.compute_all_risks(active_data, debris_data)
    return summary


@app.get("/api/risk/{norad_id}")
def get_satellite_risk(norad_id: int):
    """
    Returns a detailed risk assessment for a specific satellite, including nearby debris counts,
    closest approach object, and recommended avoidance maneuvers.
    """
    active_sats = propagator.parse_tle_file(tle_fetcher.active_file)
    target_sat = None
    for sat in active_sats:
        if int(sat.model.satnum) == norad_id:
            target_sat = sat
            break

    if not target_sat:
        raise HTTPException(status_code=404, detail=f"Active satellite {norad_id} not found.")

    sat_info = propagator.propagate_satellite(target_sat)
    debris_data = propagator.propagate_catalog(tle_fetcher.debris_file)
    risk_data = risk_engine.calculate_satellite_risk(sat_info, debris_data)
    return risk_data


@app.get("/api/conjunctions")
def get_conjunction_alerts():
    """
    Returns close-approach conjunction alerts predicted over the next 24 hours
    between operational spacecraft and debris objects using Foster-1992 Pc integration.
    """
    conj_file = os.path.join(os.path.dirname(__file__), "data", "conjunctions.json")
    if os.path.exists(conj_file):
        try:
            with open(conj_file, "r", encoding="utf-8") as f:
                data = json.load(f)
                return {
                    "count": data.get("total_conjunctions", len(data.get("conjunctions", []))),
                    "critical_count": data.get("critical_conjunctions", 0),
                    "warning_count": data.get("warning_conjunctions", 0),
                    "conjunctions": data.get("conjunctions", []),
                }
        except Exception as e:
            logger.warning(f"Failed loading {conj_file}: {e}")

    active_sats = propagator.parse_tle_file(tle_fetcher.active_file)
    debris_sats = propagator.parse_tle_file(tle_fetcher.debris_file)

    conjunctions = conjunction_detector.scan_conjunctions(
        active_sats,
        debris_sats,
        hours_ahead=24,
        step_minutes=1.0 / 6.0,  # 10 s grid: at ~15 km/s a 15-minute grid misses almost every encounter
        miss_threshold_km=30.0,
    )

    return {
        "count": len(conjunctions),
        "conjunctions": conjunctions,
    }


@app.get("/api/passes")
def get_satellite_passes(
    city: Optional[str] = Query(default=None, description="City or space center name (e.g. Bangalore, Sriharikota)"),
    lat: Optional[float] = Query(default=None, description="Ground latitude"),
    lon: Optional[float] = Query(default=None, description="Ground longitude"),
    norad_id: int = Query(default=25544, description="Satellite NORAD ID (default 25544 = ISS)"),
    days: int = Query(default=5, description="Lookahead window in days"),
):
    """
    Predicts upcoming ground passes (AOS, Max Elevation, LOS) over a ground station
    and returns 2D ground track trajectory points.
    """
    location = pass_predictor.resolve_location(city, lat=lat, lon=lon)

    # Locate target satellite
    active_sats = propagator.parse_tle_file(tle_fetcher.active_file)
    debris_sats = propagator.parse_tle_file(tle_fetcher.debris_file)
    all_sats = active_sats + debris_sats

    target_sat = None
    for sat in all_sats:
        if int(sat.model.satnum) == norad_id:
            target_sat = sat
            break

    if not target_sat:
        # Default to ISS if specific id was not found
        target_sat = active_sats[0] if active_sats else None

    if not target_sat:
        raise HTTPException(status_code=404, detail="No satellite available for pass prediction.")

    passes = pass_predictor.predict_passes(
        target_sat,
        lat=location["lat"],
        lon=location["lon"],
        alt_m=location.get("alt_m", 100.0),
        days=days,
        min_elevation_deg=10.0,
        max_results=10,
    )

    # Generate ground track coordinates (-45 min to +45 min)
    ground_track = pass_predictor.compute_ground_track(target_sat)

    return {
        "ground_station": location,
        "satellite": {
            "norad_id": int(target_sat.model.satnum),
            "name": target_sat.name,
        },
        "pass_count": len(passes),
        "passes": passes,
        "ground_track": ground_track,
    }


@app.get("/api/ground-stations")
def get_ground_stations():
    """Returns list of curated spaceports and ground station hubs."""
    return list(FAMOUS_GROUND_STATIONS.values())


@app.get("/api/analytics")
def get_analytics():
    """
    Returns macro analytics: object breakdown (satellites, debris, rocket bodies),
    altitude distribution histogram, launch year trend (1957-present), and country counts.
    """
    active_data = propagator.propagate_catalog(tle_fetcher.active_file, limit=150)
    debris_data = propagator.propagate_catalog(tle_fetcher.debris_file, limit=60)
    all_objects = active_data + debris_data

    # Breakdown by object type
    satellites_count = sum(1 for o in all_objects if o.get("object_type") == "Satellite")
    debris_count = sum(1 for o in all_objects if o.get("object_type") == "Debris")
    rocket_bodies_count = sum(1 for o in all_objects if o.get("object_type") == "Rocket Body")

    type_breakdown = [
        {"name": "Operational Satellites", "value": satellites_count, "color": "#10b981"},
        {"name": "Space Debris & Fragments", "value": debris_count, "color": "#ef4444"},
        {"name": "Rocket Upper Stages", "value": rocket_bodies_count, "color": "#f59e0b"},
    ]

    # Altitude histogram (binned into 100-200 km intervals)
    alt_bins = [
        {"range": "200-400 km", "count": 0},
        {"range": "400-600 km", "count": 0},
        {"range": "600-800 km", "count": 0},
        {"range": "800-1000 km", "count": 0},
        {"range": "1000-1500 km", "count": 0},
        {"range": "1500-2000 km", "count": 0},
        {"range": "MEO (2-35k km)", "count": 0},
        {"range": "GEO (~36k km)", "count": 0},
    ]

    for obj in all_objects:
        alt = obj.get("alt_km", 0)
        if alt < 400:
            alt_bins[0]["count"] += 1
        elif alt < 600:
            alt_bins[1]["count"] += 1
        elif alt < 800:
            alt_bins[2]["count"] += 1
        elif alt < 1000:
            alt_bins[3]["count"] += 1
        elif alt < 1500:
            alt_bins[4]["count"] += 1
        elif alt < 2000:
            alt_bins[5]["count"] += 1
        elif alt < 35000:
            alt_bins[6]["count"] += 1
        else:
            alt_bins[7]["count"] += 1

    # Country-wise satellite count (Top countries)
    country_map: Dict[str, int] = {}
    for obj in active_data:
        c = obj.get("country", "Unknown")
        country_map[c] = country_map.get(c, 0) + 1

    country_ranking = [
        {"country": c, "satellites": count}
        for c, count in sorted(country_map.items(), key=lambda x: x[1], reverse=True)[:10]
    ]

    # Historical launch year trend data (Synthesized distribution representing 1957-2026 Space Age)
    launch_years = [
        {"year": 1960, "launches": 18, "debris_events": 1},
        {"year": 1970, "launches": 84, "debris_events": 3},
        {"year": 1980, "launches": 112, "debris_events": 5},
        {"year": 1990, "launches": 135, "debris_events": 8},
        {"year": 2000, "launches": 92, "debris_events": 12},
        {"year": 2007, "launches": 115, "debris_events": 3540},  # Fengyun-1C ASAT event
        {"year": 2009, "launches": 128, "debris_events": 2290},  # Iridium-Cosmos collision
        {"year": 2015, "launches": 280, "debris_events": 45},
        {"year": 2018, "launches": 560, "debris_events": 68},
        {"year": 2020, "launches": 1140, "debris_events": 92},
        {"year": 2022, "launches": 1820, "debris_events": 140},
        {"year": 2024, "launches": 2680, "debris_events": 210},
        {"year": 2026, "launches": 3210, "debris_events": 280},
    ]

    return {
        "total_tracked_objects": len(all_objects),
        "active_satellites": len(active_data),
        "debris_pieces": len(debris_data),
        "type_breakdown": type_breakdown,
        "altitude_histogram": alt_bins,
        "country_distribution": country_ranking,
        "launch_trend": launch_years,
    }


@app.post("/api/refresh")
def trigger_refresh(x_refresh_token: Optional[str] = Header(default=None)):
    """Force an immediate TLE refresh from CelesTrak. Requires the REFRESH_TOKEN env var + matching header."""
    expected = os.getenv("REFRESH_TOKEN")
    if not expected or not x_refresh_token or not secrets.compare_digest(x_refresh_token, expected):
        raise HTTPException(status_code=403, detail="Refresh disabled or invalid token.")
    success_active = tle_fetcher.refresh_active_satellites()
    success_debris = tle_fetcher.refresh_debris()
    return {
        "message": "TLE refresh cycle triggered.",
        "active_satellites_refreshed": success_active,
        "debris_refreshed": success_debris,
    }


if __name__ == "__main__":
    import uvicorn

    port = int(os.getenv("PORT", "8000"))
    host = os.getenv("HOST", "0.0.0.0")
    uvicorn.run("backend.main:app", host=host, port=port, reload=True)
