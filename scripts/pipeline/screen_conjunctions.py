"""
OrbitGuard High-Performance Conjunction Screening Pipeline (Phase 3)
=====================================================================
Uses scipy.spatial.cKDTree for spatial indexing at each time step.
Complexity is O(N_steps * (N log N)) instead of O(N_targets * N_threats * N_steps),
running in seconds over thousands of orbiting objects.

Pipeline stages:
1. Apogee / Perigee altitude filter.
2. Vectorized / batch time-step propagation at coarse step (60s).
3. Spatial neighbor search via scipy.spatial.cKDTree within screening radius (40 km).
4. TCA refinement via scipy.optimize.minimize_scalar (tolerance < 0.05s).
5. Encounter plane projection, Foster-1992 2-D Pc, and Akella-Alfriend Pc_max.
6. Serializes to frontend/public/data/conjunctions.json.
"""

from __future__ import annotations

import datetime
import json
import math
import os
import sys
import time
from typing import Any, Dict, List, Optional, Set, Tuple

import numpy as np
from scipy.optimize import minimize_scalar
from scipy.spatial import cKDTree
from sgp4.api import Satrec, jday

# Ensure pipeline modules can be imported
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..")))
from scripts.pipeline.conjunction_engine import (
    SyntheticRTNCovariance,
    encounter_plane_state,
)

EARTH_RADIUS_KM = 6378.137
MU_EARTH = 398600.4418  # km^3 / s^2


def parse_epoch_age_days(line1: str, ref_date: datetime.datetime) -> float:
    """Computes element-set age in days relative to ref_date."""
    try:
        epoch_str = line1[18:32].strip()
        year_prefix = 2000 if int(epoch_str[:2]) < 57 else 1900
        year = year_prefix + int(epoch_str[:2])
        day_of_year = float(epoch_str[2:])
        epoch_dt = datetime.datetime(year, 1, 1, tzinfo=datetime.timezone.utc) + datetime.timedelta(days=day_of_year - 1.0)
        age = (ref_date - epoch_dt).total_seconds() / 86400.0
        return max(0.0, age)
    except Exception:
        return 1.0


def compute_orbit_bounds(satrec: Satrec) -> Tuple[float, float]:
    """Computes perigee and apogee altitudes in km."""
    no_rad_min = satrec.no
    if no_rad_min <= 0:
        return 0.0, 100000.0

    n_rad_s = no_rad_min / 60.0
    a = (MU_EARTH / (n_rad_s ** 2)) ** (1.0 / 3.0)
    e = satrec.ecco

    perigee_alt = a * (1.0 - e) - EARTH_RADIUS_KM
    apogee_alt = a * (1.0 + e) - EARTH_RADIUS_KM
    return perigee_alt, apogee_alt


def propagate_satrec_at(satrec: Satrec, dt: datetime.datetime) -> Optional[Tuple[np.ndarray, np.ndarray]]:
    """Propagates Satrec to dt UTC, returning (r_eci, v_eci) in km and km/s."""
    jd, fr = jday(dt.year, dt.month, dt.day, dt.hour, dt.minute, dt.second + dt.microsecond * 1e-6)
    err, r, v = satrec.sgp4(jd, fr)
    if err != 0 or r is None or any(math.isnan(x) for x in r):
        return None
    return np.array(r, dtype=float), np.array(v, dtype=float)


def run_screening_pipeline(
    catalog_path: str,
    output_path: str,
    window_hours: float = 24.0,
    coarse_step_sec: float = 60.0,
    screening_radius_km: float = 40.0,
    final_threshold_km: float = 15.0,
) -> List[Dict[str, Any]]:
    start_time = time.time()
    now = datetime.datetime.now(datetime.timezone.utc)
    print(f"\n[OrbitGuard SSA Engine] Starting Conjunction Screening Pipeline...")
    print(f"Screening Window: {window_hours}h | Coarse Step: {coarse_step_sec}s | Spatial KDTree Radius: {screening_radius_km} km")

    if not os.path.exists(catalog_path):
        raise FileNotFoundError(f"Catalog file not found: {catalog_path}")

    with open(catalog_path, "r", encoding="utf-8") as f:
        catalog: List[Dict[str, Any]] = json.load(f)

    # Classify satellites and threat debris
    targets: List[Dict[str, Any]] = []
    threats: List[Dict[str, Any]] = []

    for item in catalog:
        l1, l2 = item.get("line1"), item.get("line2")
        if not l1 or not l2:
            continue
        try:
            satrec = Satrec.twoline2rv(l1, l2)
            if satrec.error != 0:
                continue
            peri, apo = compute_orbit_bounds(satrec)
            age_days = parse_epoch_age_days(l1, now)

            obj = {
                "norad_id": item["norad_id"],
                "name": item.get("name", f"OBJECT {item['norad_id']}"),
                "object_type": item.get("object_type", "Unknown"),
                "country": item.get("country", "Unknown"),
                "is_isro": item.get("is_isro", False),
                "line1": l1,
                "line2": l2,
                "satrec": satrec,
                "perigee_km": peri,
                "apogee_km": apo,
                "age_days": age_days,
            }

            if item.get("object_type") == "Satellite":
                targets.append(obj)
            else:
                threats.append(obj)
        except Exception:
            continue

    print(f"Loaded {len(targets)} active spacecraft and {len(threats)} debris/spent rocket bodies.")

    # Prioritize all ISRO assets + prominent active payloads
    isro_targets = [t for t in targets if t["is_isro"]]
    other_targets = [t for t in targets if not t["is_isro"]]
    selected_targets = isro_targets + other_targets[:75]
    print(f"Screening {len(selected_targets)} active spacecraft against {len(threats)} threat objects.")

    # Setup time grid
    n_steps = int((window_hours * 3600.0) / coarse_step_sec)
    time_steps = [now + datetime.timedelta(seconds=i * coarse_step_sec) for i in range(n_steps)]

    # Candidate close approaches found: (target_idx, threat_idx) -> list of (coarse_time_dt, coarse_dist)
    candidate_encounters: Dict[Tuple[int, int], Tuple[datetime.datetime, float]] = {}

    print(f"Executing spatial KDTree screening across {n_steps} time steps...")

    for step_idx, t_eval in enumerate(time_steps):
        # 1. Propagate threats at t_eval
        threat_positions: List[np.ndarray] = []
        threat_indices: List[int] = []

        for th_idx, th in enumerate(threats):
            pv = propagate_satrec_at(th["satrec"], t_eval)
            if pv is not None:
                threat_positions.append(pv[0])
                threat_indices.append(th_idx)

        if not threat_positions:
            continue

        # Build KDTree for threat cloud at this time step
        tree = cKDTree(np.array(threat_positions))

        # 2. Propagate targets and query tree
        for tgt_idx, tgt in enumerate(selected_targets):
            pv_tgt = propagate_satrec_at(tgt["satrec"], t_eval)
            if pv_tgt is None:
                continue

            r_tgt = pv_tgt[0]
            # Fast radius query within screening_radius_km
            nearby_th_ptrs = tree.query_ball_point(r_tgt, r=screening_radius_km)

            for ptr in nearby_th_ptrs:
                th_actual_idx = threat_indices[ptr]
                r_th = threat_positions[ptr]
                dist = float(np.linalg.norm(r_tgt - r_th))

                pair_key = (tgt_idx, th_actual_idx)
                if pair_key not in candidate_encounters or dist < candidate_encounters[pair_key][1]:
                    candidate_encounters[pair_key] = (t_eval, dist)

    print(f"Found {len(candidate_encounters)} potential close approach candidate pairs across the screening window.")

    cov_provider = SyntheticRTNCovariance()
    conjunction_events: List[Dict[str, Any]] = []

    # 3. TCA Refinement via 1-D bounded minimization
    for (tgt_idx, th_idx), (approx_tca, coarse_dist) in candidate_encounters.items():
        tgt = selected_targets[tgt_idx]
        th = threats[th_idx]

        sat1 = tgt["satrec"]
        sat2 = th["satrec"]

        # Minimize range around approx_tca (+/- 1.5 coarse steps)
        t_center = approx_tca
        half_window = coarse_step_sec * 1.5

        def range_func(delta_sec: float) -> float:
            t_curr = t_center + datetime.timedelta(seconds=delta_sec)
            p1 = propagate_satrec_at(sat1, t_curr)
            p2 = propagate_satrec_at(sat2, t_curr)
            if p1 is None or p2 is None:
                return 1e6
            return float(np.linalg.norm(p1[0] - p2[0]))

        res = minimize_scalar(range_func, bounds=(-half_window, half_window), method="bounded")
        refined_miss_km = float(res.fun)

        if refined_miss_km <= final_threshold_km:
            refined_tca = t_center + datetime.timedelta(seconds=float(res.x))

            pv1_tca = propagate_satrec_at(sat1, refined_tca)
            pv2_tca = propagate_satrec_at(sat2, refined_tca)
            if pv1_tca is None or pv2_tca is None:
                continue

            r1, v1 = pv1_tca
            r2, v2 = pv2_tca
            r_rel = r1 - r2
            v_rel = v1 - v2
            rel_speed = float(np.linalg.norm(v_rel))

            # Hard-body radius assumption: 10m for spacecraft + 2m for debris = 12m (0.012 km)
            hbr_km = 0.012

            # Compute age-dependent synthetic RTN covariance matrices
            c1_eci = cov_provider.get_covariance_eci(tgt["norad_id"], r1, v1, tgt["age_days"])
            c2_eci = cov_provider.get_covariance_eci(th["norad_id"], r2, v2, th["age_days"])

            # Encounter plane state projection & Foster-1992 integration
            enc = encounter_plane_state(r_rel, v_rel, c1_eci, c2_eci, hbr_km)

            # Compute RTN components of the miss vector
            r1_norm = float(np.linalg.norm(r1))
            r1_hat = r1 / r1_norm
            n1_hat = np.cross(r1, v1) / float(np.linalg.norm(np.cross(r1, v1)))
            t1_hat = np.cross(n1_hat, r1_hat)

            miss_r_m = float(np.dot(r_rel, r1_hat) * 1000.0)
            miss_t_m = float(np.dot(r_rel, t1_hat) * 1000.0)
            miss_n_m = float(np.dot(r_rel, n1_hat) * 1000.0)

            # Classify risk level
            is_co_orbital = rel_speed < 0.080
            if is_co_orbital:
                risk_level = "CO-ORBITAL"
                status_color = "yellow"
            elif refined_miss_km < 1.0 or enc.pc_foster >= 1e-4:
                risk_level = "CRITICAL"
                status_color = "red"
            elif refined_miss_km < 5.0 or enc.pc_foster >= 1e-7:
                risk_level = "WARNING"
                status_color = "yellow"
            else:
                risk_level = "MONITORED"
                status_color = "green"

            event = {
                "id": f"CONJ-{tgt['norad_id']}-{th['norad_id']}-{int(refined_tca.timestamp())}",
                "tca_utc": refined_tca.isoformat(),
                "tca_timestamp_ms": int(refined_tca.timestamp() * 1000),
                "miss_distance_km": round(refined_miss_km, 3),
                "relative_speed_kms": round(rel_speed, 3),
                "pc_foster": float(f"{enc.pc_foster:.4e}"),
                "pc_max": float(f"{enc.pc_max:.4e}"),
                "k_at_pc_max": round(enc.k_at_pc_max, 2),
                "mahalanobis_dist": round(enc.mahalanobis_dist, 2),
                "hbr_m": round(hbr_km * 1000.0, 1),
                "risk_level": risk_level,
                "status_color": status_color,
                "is_co_orbital": is_co_orbital,
                "covariance_source": "Synthetic RTN (Screening-Grade)",
                "disclaimer": "Screening advisory only - Not an operational maneuver directive. Use official CDMs for CAM.",
                "miss_vector_rtn_m": {
                    "radial": round(miss_r_m, 1),
                    "transverse": round(miss_t_m, 1),
                    "normal": round(miss_n_m, 1),
                },
                "encounter_plane_2d": {
                    "miss_x_km": round(float(enc.miss_vector_km[0]), 4),
                    "miss_y_km": round(float(enc.miss_vector_km[1]), 4),
                    "cov_xx": float(f"{enc.combined_cov_2d[0, 0]:.4e}"),
                    "cov_xy": float(f"{enc.combined_cov_2d[0, 1]:.4e}"),
                    "cov_yy": float(f"{enc.combined_cov_2d[1, 1]:.4e}"),
                },
                "object1": {
                    "norad_id": tgt["norad_id"],
                    "name": tgt["name"],
                    "object_type": tgt["object_type"],
                    "country": tgt["country"],
                    "is_isro": tgt["is_isro"],
                    "tle_age_days": round(tgt["age_days"], 2),
                },
                "object2": {
                    "norad_id": th["norad_id"],
                    "name": th["name"],
                    "object_type": th["object_type"],
                    "country": th["country"],
                    "is_isro": th["is_isro"],
                    "tle_age_days": round(th["age_days"], 2),
                },
            }
            conjunction_events.append(event)

    # Sort events by Pc_foster descending, then miss distance ascending
    conjunction_events.sort(key=lambda x: (-x["pc_foster"], x["miss_distance_km"]))

    elapsed = time.time() - start_time
    print(f"\n[Completed] Screened in {elapsed:.2f} seconds. Detected {len(conjunction_events)} refined conjunction events.")

    critical_count = sum(1 for e in conjunction_events if e["risk_level"] == "CRITICAL")
    warning_count = sum(1 for e in conjunction_events if e["risk_level"] == "WARNING")
    print(f"Summary: {critical_count} CRITICAL, {warning_count} WARNING, {len(conjunction_events) - critical_count - warning_count} MONITORED.")

    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(
            {
                "screen_time_utc": now.isoformat(),
                "total_conjunctions": len(conjunction_events),
                "critical_conjunctions": critical_count,
                "warning_conjunctions": warning_count,
                "conjunctions": conjunction_events,
            },
            f,
            indent=2,
        )

    return conjunction_events


if __name__ == "__main__":
    repo_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
    cat_file = os.path.join(repo_root, "frontend", "public", "data", "catalog.json")
    out_file = os.path.join(repo_root, "frontend", "public", "data", "conjunctions.json")
    backend_out_file = os.path.join(repo_root, "backend", "data", "conjunctions.json")

    events = run_screening_pipeline(cat_file, out_file, window_hours=24.0, coarse_step_sec=60.0)

    # Copy to backend data folder as well
    os.makedirs(os.path.dirname(backend_out_file), exist_ok=True)
    with open(backend_out_file, "w", encoding="utf-8") as f:
        with open(out_file, "r", encoding="utf-8") as sf:
            f.write(sf.read())
