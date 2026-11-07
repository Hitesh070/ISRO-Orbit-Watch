"""
OrbitGuard Conjunction Screening Pipeline
=========================================
Stages
1. Parse catalog -> SGP4 satrecs (decayed / unparseable objects skipped).
2. Vectorised batch propagation (sgp4.api.SatrecArray) on a coarse time grid, in time chunks.
3. Candidate search: cKDTree ball query + linearised time-of-closest-approach prefilter
   (see screening_core.py for why a fixed 40 km ball on a coarse grid is insufficient).
4. TCA refinement with true SGP4 (scipy bounded minimisation).
5. Encounter-plane projection, Foster-1992 Pc and Akella-Alfriend Pc_max.
6. Writes frontend/public/data/conjunctions.json (+ backend/data copy).
"""

from __future__ import annotations

import datetime
import json
import math
import os
import shutil
import sys
import time
from typing import Any, Dict, List, Optional, Tuple

import numpy as np
from scipy.optimize import minimize_scalar
from sgp4.api import Satrec, SatrecArray, jday

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..")))
from scripts.pipeline.conjunction_engine import (  # noqa: E402
    SyntheticRTNCovariance,
    encounter_plane_state,
)
from scripts.pipeline.screening_core import screen_candidates  # noqa: E402

EARTH_RADIUS_KM = 6378.137
MU_EARTH = 398600.4418  # km^3 / s^2

# Hard-body radius assumptions (km), matching config/covariance.yaml defaults.
HBR_KM = {"Satellite": 0.0075, "Debris": 0.0020, "Rocket Body": 0.012}
DEFAULT_HBR_KM = 0.0075


def parse_epoch_age_days(line1: str, ref_date: datetime.datetime) -> float:
    """Computes element-set age in days relative to ref_date."""
    try:
        epoch_str = line1[18:32].strip()
        year_prefix = 2000 if int(epoch_str[:2]) < 57 else 1900
        year = year_prefix + int(epoch_str[:2])
        day_of_year = float(epoch_str[2:])
        epoch_dt = datetime.datetime(year, 1, 1, tzinfo=datetime.timezone.utc) + datetime.timedelta(days=day_of_year - 1.0)
        return max(0.0, (ref_date - epoch_dt).total_seconds() / 86400.0)
    except Exception:
        return 1.0


def compute_orbit_bounds(satrec: Satrec) -> Tuple[float, float]:
    """Computes perigee and apogee altitudes in km."""
    no_rad_min = satrec.no_kozai if hasattr(satrec, "no_kozai") else satrec.no
    if no_rad_min <= 0:
        return 0.0, 100000.0
    n_rad_s = no_rad_min / 60.0
    a = (MU_EARTH / (n_rad_s**2)) ** (1.0 / 3.0)
    e = satrec.ecco
    return a * (1.0 - e) - EARTH_RADIUS_KM, a * (1.0 + e) - EARTH_RADIUS_KM


def propagate_satrec_at(satrec: Satrec, dt: datetime.datetime) -> Optional[Tuple[np.ndarray, np.ndarray]]:
    """Propagates one Satrec to dt (UTC); returns (r_km, v_kms) or None on SGP4 error."""
    jd, fr = jday(dt.year, dt.month, dt.day, dt.hour, dt.minute, dt.second + dt.microsecond * 1e-6)
    err, r, v = satrec.sgp4(jd, fr)
    if err != 0 or r is None or any(math.isnan(x) for x in r):
        return None
    return np.array(r, dtype=float), np.array(v, dtype=float)


def propagate_chunk(
    sat_array: SatrecArray, jd0: float, fr0: float, step_sec: float, first: int, count: int
) -> Tuple[np.ndarray, np.ndarray]:
    """Propagate a SatrecArray for `count` grid steps starting at step index `first` (float32 output)."""
    idx = np.arange(first, first + count, dtype=float)
    jd = np.full(count, jd0)
    fr = fr0 + idx * step_sec / 86400.0
    err, r, v = sat_array.sgp4(jd, fr)
    bad = (err != 0)[..., None]
    r = np.where(bad, np.nan, r).astype(np.float32)
    v = np.where(bad, np.nan, v).astype(np.float32)
    return r, v


def run_screening_pipeline(
    catalog_path: str,
    output_path: str,
    window_hours: float = 24.0,
    coarse_step_sec: float = 30.0,
    final_threshold_km: float = 15.0,
    max_other_targets: int = 75,
    chunk_steps: int = 240,
) -> List[Dict[str, Any]]:
    start_time = time.time()
    now = datetime.datetime.now(datetime.timezone.utc)
    lin_threshold_km = final_threshold_km + 10.0  # slack for curvature over +/- half a step
    print("\n[OrbitGuard SSA Engine] Starting conjunction screening pipeline")
    print(f"Window: {window_hours} h | step: {coarse_step_sec} s | final threshold: {final_threshold_km} km")

    if not os.path.exists(catalog_path):
        raise FileNotFoundError(f"Catalog file not found: {catalog_path}")
    with open(catalog_path, "r", encoding="utf-8") as f:
        catalog: List[Dict[str, Any]] = json.load(f)

    targets: List[Dict[str, Any]] = []
    threats: List[Dict[str, Any]] = []
    for item in catalog:
        l1, l2 = item.get("line1"), item.get("line2")
        if not l1 or not l2 or item.get("status") == "decayed/invalid":
            continue
        try:
            satrec = Satrec.twoline2rv(l1, l2)
            if satrec.error != 0:
                continue
            peri, apo = compute_orbit_bounds(satrec)
            obj = {
                "norad_id": item["norad_id"],
                "name": item.get("name", f"OBJECT {item['norad_id']}"),
                "object_type": item.get("object_type", "Unknown"),
                "country": item.get("country", "Unknown"),
                "is_isro": item.get("is_isro", False),
                "satrec": satrec,
                "perigee_km": peri,
                "apogee_km": apo,
                "age_days": parse_epoch_age_days(l1, now),
            }
            (targets if item.get("object_type") == "Satellite" else threats).append(obj)
        except Exception:
            continue
    print(f"Loaded {len(targets)} active spacecraft and {len(threats)} debris/rocket bodies.")

    isro = [t for t in targets if t["is_isro"]]
    others = [t for t in targets if not t["is_isro"]]
    selected = isro + others[:max_other_targets]
    print(f"Screening {len(selected)} spacecraft against {len(threats)} threat objects.")

    candidates: Dict[Tuple[int, int], Tuple[float, float]] = {}
    if selected and threats:
        jd0, fr0 = jday(now.year, now.month, now.day, now.hour, now.minute, now.second + now.microsecond * 1e-6)
        n_steps = int(window_hours * 3600.0 / coarse_step_sec)
        tgt_arr = SatrecArray([t["satrec"] for t in selected])
        thr_arr = SatrecArray([t["satrec"] for t in threats])
        for first in range(0, n_steps, chunk_steps):
            count = min(chunk_steps, n_steps - first)
            tr, tv = propagate_chunk(tgt_arr, jd0, fr0, coarse_step_sec, first, count)
            hr, hv = propagate_chunk(thr_arr, jd0, fr0, coarse_step_sec, first, count)
            found = screen_candidates(
                tr, tv, hr, hv, coarse_step_sec, lin_threshold_km, t0_offset_sec=first * coarse_step_sec
            )
            for key, cand in found.items():
                if key not in candidates or cand[0] < candidates[key][0]:
                    candidates[key] = cand
    print(f"{len(candidates)} candidate pairs after linearised TCA prefilter.")

    cov_provider = SyntheticRTNCovariance()
    events: List[Dict[str, Any]] = []

    for (tgt_idx, th_idx), (_lin_miss, tca_offset_sec) in candidates.items():
        tgt, th = selected[tgt_idx], threats[th_idx]
        if tgt["norad_id"] == th["norad_id"]:
            continue
        sat1, sat2 = tgt["satrec"], th["satrec"]
        t_center = now + datetime.timedelta(seconds=tca_offset_sec)
        half_window = coarse_step_sec

        def range_func(delta_sec: float, _c=t_center, _s1=sat1, _s2=sat2) -> float:
            t_curr = _c + datetime.timedelta(seconds=delta_sec)
            p1, p2 = propagate_satrec_at(_s1, t_curr), propagate_satrec_at(_s2, t_curr)
            if p1 is None or p2 is None:
                return 1e6
            return float(np.linalg.norm(p1[0] - p2[0]))

        res = minimize_scalar(
            range_func, bounds=(-half_window, half_window), method="bounded", options={"xatol": 1e-3}
        )
        miss_km = float(res.fun)
        if miss_km > final_threshold_km:
            continue

        refined_tca = t_center + datetime.timedelta(seconds=float(res.x))
        pv1, pv2 = propagate_satrec_at(sat1, refined_tca), propagate_satrec_at(sat2, refined_tca)
        if pv1 is None or pv2 is None:
            continue
        r1, v1 = pv1
        r2, v2 = pv2
        r_rel, v_rel = r1 - r2, v1 - v2
        rel_speed = float(np.linalg.norm(v_rel))
        hbr_km = HBR_KM.get(tgt["object_type"], DEFAULT_HBR_KM) + HBR_KM.get(th["object_type"], DEFAULT_HBR_KM)

        c1 = cov_provider.get_covariance_eci(tgt["norad_id"], r1, v1, tgt["age_days"])
        c2 = cov_provider.get_covariance_eci(th["norad_id"], r2, v2, th["age_days"])
        enc = encounter_plane_state(r_rel, v_rel, c1, c2, hbr_km)

        r1_hat = r1 / float(np.linalg.norm(r1))
        h1 = np.cross(r1, v1)
        n1_hat = h1 / float(np.linalg.norm(h1))
        t1_hat = np.cross(n1_hat, r1_hat)
        miss_r_m = float(np.dot(r_rel, r1_hat) * 1000.0)
        miss_t_m = float(np.dot(r_rel, t1_hat) * 1000.0)
        miss_n_m = float(np.dot(r_rel, n1_hat) * 1000.0)

        is_co_orbital = rel_speed < 0.080
        if is_co_orbital:
            risk_level, status_color = "CO-ORBITAL", "yellow"
        elif miss_km < 1.0 or enc.pc_foster >= 1e-4:
            risk_level, status_color = "CRITICAL", "red"
        elif miss_km < 5.0 or enc.pc_foster >= 1e-7:
            risk_level, status_color = "WARNING", "yellow"
        else:
            risk_level, status_color = "MONITORED", "green"

        events.append(
            {
                "id": f"CONJ-{tgt['norad_id']}-{th['norad_id']}-{int(refined_tca.timestamp())}",
                "tca_utc": refined_tca.isoformat(),
                "tca_timestamp_ms": int(refined_tca.timestamp() * 1000),
                "miss_distance_km": round(miss_km, 3),
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
        )

    events.sort(key=lambda x: (-x["pc_foster"], x["miss_distance_km"]))
    critical = sum(1 for e in events if e["risk_level"] == "CRITICAL")
    warning = sum(1 for e in events if e["risk_level"] == "WARNING")
    print(f"[Done] {time.time() - start_time:.1f} s. {len(events)} events: {critical} CRITICAL, {warning} WARNING.")

    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(
            {
                "screen_time_utc": now.isoformat(),
                "window_hours": window_hours,
                "total_conjunctions": len(events),
                "critical_conjunctions": critical,
                "warning_conjunctions": warning,
                "conjunctions": events,
            },
            f,
            indent=2,
        )
    return events


if __name__ == "__main__":
    repo_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
    cat_file = os.path.join(repo_root, "frontend", "public", "data", "catalog.json")
    out_file = os.path.join(repo_root, "frontend", "public", "data", "conjunctions.json")
    backend_out = os.path.join(repo_root, "backend", "data", "conjunctions.json")

    run_screening_pipeline(cat_file, out_file)

    os.makedirs(os.path.dirname(backend_out), exist_ok=True)
    shutil.copyfile(out_file, backend_out)
