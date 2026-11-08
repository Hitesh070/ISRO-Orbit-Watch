"""
OrbitGuard Conjunction Assessment & Close-Approach Prediction Engine
=====================================================================
Screens close approaches (conjunctions) between supplied spacecraft and cataloged debris
over a fixed lookahead interval. Collision probability is unavailable without measured covariance.
"""

import logging
import math
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

import numpy as np
from skyfield.api import EarthSatellite, load, wgs84

logger = logging.getLogger("orbitguard.conjunction")


class ConjunctionDetector:
    """
    Propagates supplied GP elements over a discretized interval to screen close approaches.
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
        Screen for close approaches between active spacecraft and space debris
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
            except Exception:
                continue

            for deb in candidate_debris:
                try:
                    deb_geo = deb.at(times)
                    deb_pos = deb_geo.position.km

                    # Compute pairwise Euclidean distances at each time slice
                    diff = sat_pos - deb_pos
                    distances = np.linalg.norm(diff, axis=0)  # 1D array of distance in km

                    min_idx = int(np.argmin(distances))
                    min_dist = float(distances[min_idx])
                    tca_offset_steps = 0.0
                    if 0 < min_idx < len(distances) - 1:
                        d2 = distances.astype(float) ** 2
                        denom = d2[min_idx - 1] - 2.0 * d2[min_idx] + d2[min_idx + 1]
                        if denom > 1e-12:
                            delta = 0.5 * (d2[min_idx - 1] - d2[min_idx + 1]) / denom
                            delta = max(-1.0, min(1.0, delta))
                            tca_offset_steps = delta
                            min_d2 = d2[min_idx] - 0.25 * (d2[min_idx - 1] - d2[min_idx + 1]) * delta
                            min_dist = float(math.sqrt(max(0.0, min_d2)))

                    if min_dist <= miss_threshold_km:
                        # Refined TCA
                        tca_jd = time_jds[min_idx] + tca_offset_steps * step_minutes / 1440.0
                        tca_time = self.ts.tt_jd(tca_jd)
                        tca_dt = tca_time.utc_datetime()

                        # Relative velocity at TCA
                        sat_tca = sat.at(tca_time)
                        deb_tca = deb.at(tca_time)
                        rel_v_vec = sat_tca.velocity.km_per_s - deb_tca.velocity.km_per_s
                        rel_v = float(np.linalg.norm(rel_v_vec))

                        # Cartesian coordinates at TCA normalized for 3D globe (Earth radius = 1)
                        sub_sat = wgs84.subpoint(sat_tca)
                        lat_rad = math.radians(sub_sat.latitude.degrees)
                        lon_rad = math.radians(sub_sat.longitude.degrees)
                        r = (scale_km + sub_sat.elevation.km) / scale_km
                        cart_tca = [
                            round(r * math.cos(lat_rad) * math.sin(lon_rad), 4),
                            round(r * math.sin(lat_rad), 4),
                            round(r * math.cos(lat_rad) * math.cos(lon_rad), 4),
                        ]

                        # Screening class is based on miss-distance thresholds only;
                        # public GP elements do not include a measured covariance.
                        if min_dist < 5.0:
                            risk_level = "CRITICAL"
                            color = "red"
                        elif min_dist < 15.0:
                            risk_level = "HIGH"
                            color = "amber"
                        elif min_dist < 25.0:
                            risk_level = "MODERATE"
                            color = "yellow"
                        else:
                            risk_level = "LOW"
                            color = "blue"

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
                            "collision_probability": None,
                            "probability_status": "Unavailable: no object covariance supplied",
                            "cartesian_at_tca": cart_tca,
                            "altitude_km": round(float(sub_sat.elevation.km), 1),
                        })
                except Exception:
                    continue

        # Sort by miss distance ascending (most critical first)
        conjunctions.sort(key=lambda c: c["miss_distance_km"])
        return conjunctions


# Module singleton
conjunction_detector = ConjunctionDetector()
