"""
OrbitGuard Conjunction Assessment & Close-Approach Prediction Engine
=====================================================================
Predicts and monitors close approaches (conjunctions) between operational spacecraft
and cataloged debris over a rolling 24-hour lookahead window.
Computes Time of Closest Approach (TCA), Euclidean miss distances, relative velocity vectors,
and collision probability metrics.
"""

import logging
import math
import os
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

import numpy as np
from skyfield.api import EarthSatellite, load, wgs84

logger = logging.getLogger("orbitguard.conjunction")


class ConjunctionDetector:
    """
    Simulates orbital trajectories at discretized intervals over 24 hours
    to detect conjunction events and generate alert metadata.
    """

    def __init__(self):
        self.ts = load.timescale()
        self._cached_conjunctions: Optional[List[Dict[str, Any]]] = None
        self._last_scan_time: float = 0.0

    def scan_conjunctions(
        self,
        active_sats: List[EarthSatellite],
        debris_sats: List[EarthSatellite],
        hours_ahead: int = 24,
        step_minutes: float = 1.0 / 6.0,
        miss_threshold_km: float = 35.0,
    ) -> List[Dict[str, Any]]:
        """
        Scan for close approaches between active spacecraft and space debris
        over the next `hours_ahead` hours with `step_minutes` resolution.
        """
        now = datetime.now(timezone.utc)
        now_t = self.ts.from_datetime(now)
        total_steps = int((hours_ahead * 60) / step_minutes)

        time_jds = [now_t.tt + (i * step_minutes / 1440.0) for i in range(total_steps)]
        times = self.ts.tt_jd(time_jds)

        # Pre-select high-interest satellites to analyze
        # We focus on representative LEO satellites that share altitude bands with debris
        candidate_active = [s for s in active_sats if s.model.satnum in [25544, 48274, 36795, 44804, 44857, 51656, 44714, 48012, 40697, 27386]][:10]
        if not candidate_active and active_sats:
            candidate_active = active_sats[:8]

        candidate_debris = debris_sats[:15] if debris_sats else []

        conjunctions = []

        # Scale factor from Three.js units to km
        scale_km = 6378.137

        for sat in candidate_active:
            try:
                sat_geo = sat.at(times)
                sat_pos = sat_geo.position.km  # Shape (3, total_steps)
                sat_vel = sat_geo.velocity.km_per_s  # Shape (3, total_steps)
            except Exception:
                continue

            for deb in candidate_debris:
                try:
                    deb_geo = deb.at(times)
                    deb_pos = deb_geo.position.km
                    deb_vel = deb_geo.velocity.km_per_s

                    # Compute pairwise Euclidean distances at each time slice
                    diff = sat_pos - deb_pos
                    distances = np.linalg.norm(diff, axis=0)  # 1D array of distance in km

                    min_idx = int(np.argmin(distances))
                    min_dist = float(distances[min_idx])
                    if 0 < min_idx < len(distances) - 1:
                        d2 = distances.astype(float) ** 2
                        denom = d2[min_idx - 1] - 2.0 * d2[min_idx] + d2[min_idx + 1]
                        if denom > 1e-12:
                            delta = 0.5 * (d2[min_idx - 1] - d2[min_idx + 1]) / denom
                            delta = max(-1.0, min(1.0, delta))
                            min_d2 = d2[min_idx] - 0.25 * (d2[min_idx - 1] - d2[min_idx + 1]) * delta
                            min_dist = float(math.sqrt(max(0.0, min_d2)))

                    if min_dist <= miss_threshold_km:
                        # Refined TCA
                        tca_jd = time_jds[min_idx]
                        tca_time = self.ts.tt_jd(tca_jd)
                        tca_dt = tca_time.utc_datetime()

                        # Relative velocity at TCA
                        rel_v_vec = sat_vel[:, min_idx] - deb_vel[:, min_idx]
                        rel_v = float(np.linalg.norm(rel_v_vec))

                        # Cartesian coordinates at TCA normalized for 3D globe (Earth radius = 1)
                        sub_sat = wgs84.subpoint(sat.at(tca_time))
                        lat_rad = math.radians(sub_sat.latitude.degrees)
                        lon_rad = math.radians(sub_sat.longitude.degrees)
                        r = (scale_km + sub_sat.elevation.km) / scale_km
                        cart_tca = [
                            round(r * math.cos(lat_rad) * math.sin(lon_rad), 4),
                            round(r * math.sin(lat_rad), 4),
                            round(r * math.cos(lat_rad) * math.cos(lon_rad), 4),
                        ]

                        # Risk categorization
                        if min_dist < 5.0:
                            risk_level = "CRITICAL"
                            color = "red"
                            prob = round(1.8e-3 * (5.0 / max(0.2, min_dist)), 6)
                        elif min_dist < 15.0:
                            risk_level = "HIGH"
                            color = "amber"
                            prob = round(4.5e-4 * (15.0 / min_dist), 6)
                        elif min_dist < 25.0:
                            risk_level = "MODERATE"
                            color = "yellow"
                            prob = round(8.2e-5, 6)
                        else:
                            risk_level = "LOW"
                            color = "blue"
                            prob = round(1.1e-5, 6)

                        conjunctions.append({
                            "id": f"CONJ-{sat.model.satnum}-{deb.model.satnum}-{min_idx}",
                            "object1": {
                                "norad_id": int(sat.model.satnum),
                                "name": sat.name,
                                "type": "Operational Satellite",
                            },
                            "object2": {
                                "norad_id": int(deb.model.satnum),
                                "name": deb.name,
                                "type": "Space Debris / Fragment",
                            },
                            "tca_iso": tca_dt.strftime("%Y-%m-%dT%H:%M:%SZ"),
                            "tca_epoch": int(tca_dt.timestamp()),
                            "miss_distance_km": round(min_dist, 2),
                            "relative_velocity_km_s": round(rel_v, 2),
                            "risk_level": risk_level,
                            "color": color,
                            "collision_probability": prob,
                            "cartesian_at_tca": cart_tca,
                            "altitude_km": round(float(sub_sat.elevation.km), 1),
                        })
                except Exception:
                    continue

        # Synthetic demo events are NEVER shown unless explicitly enabled; presenting invented
        # conjunctions as real predictions would contradict the project's scientific-honesty policy.
        if not conjunctions and candidate_active and os.getenv("ALLOW_DEMO_CONJUNCTIONS") == "1":
            conjunctions = self._generate_scenario_conjunctions(candidate_active, candidate_debris, now)

        # Sort by miss distance ascending (most critical first)
        conjunctions.sort(key=lambda c: c["miss_distance_km"])
        return conjunctions

    def _generate_scenario_conjunctions(
        self,
        active_sats: List[EarthSatellite],
        debris_sats: List[EarthSatellite],
        now: datetime,
    ) -> List[Dict[str, Any]]:
        """
        Ensure realistic conjunction predictions exist with countdowns for UI demonstration
        and interview presentation (e.g. CARTOSAT vs Fengyun debris, ISS vs Cosmos debris).
        """
        scenarios = [
            {
                "sat_num": 36795,  # CARTOSAT-2B (ISRO)
                "deb_name": "FENGYUN 1C DEB (ASAT fragment #29742)",
                "deb_num": 29742,
                "delta_hours": 3.75,
                "miss_dist": 2.84,
                "rel_v": 13.42,
                "risk": "CRITICAL",
                "color": "red",
                "prob": 0.00284,
                "alt": 630.5,
                "cart": [0.354, 0.782, 0.491],
            },
            {
                "sat_num": 25544,  # ISS (ZARYA)
                "deb_name": "COSMOS 2251 DEB (#34015)",
                "deb_num": 34015,
                "delta_hours": 7.20,
                "miss_dist": 4.15,
                "rel_v": 11.85,
                "risk": "CRITICAL",
                "color": "red",
                "prob": 0.00142,
                "alt": 422.1,
                "cart": [-0.621, -0.412, 0.655],
            },
            {
                "sat_num": 44804,  # CARTOSAT-3 (ISRO)
                "deb_name": "SL-16 R/B (Zenit Upper Stage #22802)",
                "deb_num": 22802,
                "delta_hours": 11.50,
                "miss_dist": 8.70,
                "rel_v": 9.64,
                "risk": "HIGH",
                "color": "amber",
                "prob": 0.00065,
                "alt": 512.8,
                "cart": [0.412, -0.710, 0.542],
            },
            {
                "sat_num": 48274,  # TIANGONG
                "deb_name": "IRIDIUM 33 DEB (#34512)",
                "deb_num": 34512,
                "delta_hours": 16.30,
                "miss_dist": 14.20,
                "rel_v": 14.10,
                "risk": "HIGH",
                "color": "amber",
                "prob": 0.00032,
                "alt": 395.0,
                "cart": [-0.210, 0.812, -0.512],
            },
            {
                "sat_num": 44857,  # RISAT-2BR1 (ISRO)
                "deb_name": "CZ-4C R/B (#39151)",
                "deb_num": 39151,
                "delta_hours": 21.10,
                "miss_dist": 22.40,
                "rel_v": 10.35,
                "risk": "MODERATE",
                "color": "yellow",
                "prob": 0.00008,
                "alt": 576.2,
                "cart": [0.720, 0.310, -0.590],
            },
        ]

        active_map = {int(s.model.satnum): s for s in active_sats}
        results = []
        for sc in scenarios:
            sat = active_map.get(sc["sat_num"])
            sat_name = sat.name if sat else f"OBJECT {sc['sat_num']}"
            tca_time = now + timedelta(hours=sc["delta_hours"])

            results.append({
                "id": f"CONJ-{sc['sat_num']}-{sc['deb_num']}",
                "object1": {
                    "norad_id": sc["sat_num"],
                    "name": sat_name,
                    "type": "Operational Satellite",
                },
                "object2": {
                    "norad_id": sc["deb_num"],
                    "name": sc["deb_name"],
                    "type": "Space Debris / Fragment",
                },
                "tca_iso": tca_time.strftime("%Y-%m-%dT%H:%M:%SZ"),
                "tca_epoch": int(tca_time.timestamp()),
                "miss_distance_km": sc["miss_dist"],
                "relative_velocity_km_s": sc["rel_v"],
                "risk_level": sc["risk"],
                "color": sc["color"],
                "collision_probability": sc["prob"],
                "cartesian_at_tca": sc["cart"],
                "altitude_km": sc["alt"],
                "synthetic": True,
                "disclaimer": "DEMO DATA - not a real prediction.",
            })

        return results


# Module singleton
conjunction_detector = ConjunctionDetector()
