"""
OrbitGuard Space Debris Risk Engine
====================================
Reports instantaneous catalog proximity counts and ranges with orbital shell statistics.
It does not assign an operational risk score or collision probability.
"""

import logging
import math
from typing import Any, Dict, List, Optional

logger = logging.getLogger("orbitguard.risk_engine")


class DebrisRiskEngine:
    """
    Computes catalog proximity counts and altitude/inclination object counts.
    """

    def __init__(self):
        self._cached_risk_results: Optional[Dict[str, Any]] = None
        self._last_calc_time: float = 0.0

    def compute_relative_velocity(self, v1: List[float], v2: List[float]) -> float:
        """Calculate relative speed magnitude in km/s between two 3D velocity vectors."""
        dx = v1[0] - v2[0]
        dy = v1[1] - v2[1]
        dz = v1[2] - v2[2]
        return math.sqrt(dx * dx + dy * dy + dz * dz)

    def calculate_satellite_risk(
        self,
        satellite: Dict[str, Any],
        debris_list: List[Dict[str, Any]],
        proximity_radius_km: float = 80.0,
    ) -> Dict[str, Any]:
        """
        Compute an instantaneous catalog proximity count for one satellite.
        """
        sat_alt = satellite.get("alt_km")
        sat_cart = satellite.get("cartesian")
        sat_v = satellite.get("velocity_vector")
        norad_id = satellite.get("norad_id")

        if (
            not isinstance(sat_alt, (int, float)) or not math.isfinite(sat_alt) or
            not isinstance(norad_id, int) or
            not isinstance(sat_cart, (list, tuple)) or len(sat_cart) != 3 or
            not all(isinstance(v, (int, float)) and math.isfinite(v) for v in sat_cart)
        ):
            return {
                "norad_id": norad_id,
                "name": satellite.get("name"),
                "risk_score": None,
                "risk_level": "UNAVAILABLE",
                "status_color": "gray",
                "nearby_debris_count": None,
                "avg_relative_velocity_km_s": None,
                "closest_debris_distance_km": None,
                "closest_debris_name": None,
                "closest_debris_norad": None,
                "collision_probability": None,
                "collision_probability_is_heuristic": False,
                "metric": "unavailable",
                "recommended_maneuver": None,
                "regime": satellite.get("regime"),
                "altitude_km": sat_alt,
                "country": satellite.get("country"),
                "inclination": satellite.get("inclination"),
            }

        nearby_debris = []
        closest_distance = float("inf")
        closest_debris_name = None
        closest_debris_norad = None

        # Physical Earth radius conversion factor: unit cartesian distance -> km
        scale_km = 6378.137

        for deb in debris_list:
            if deb.get("norad_id") == norad_id:
                continue

            deb_cart = deb.get("cartesian")
            if not isinstance(deb_cart, (list, tuple)) or len(deb_cart) != 3 or not all(isinstance(v, (int, float)) for v in deb_cart):
                continue
            dx = (sat_cart[0] - deb_cart[0]) * scale_km
            dy = (sat_cart[1] - deb_cart[1]) * scale_km
            dz = (sat_cart[2] - deb_cart[2]) * scale_km
            dist_km = math.sqrt(dx * dx + dy * dy + dz * dz)

            if dist_km < closest_distance:
                closest_distance = dist_km
                closest_debris_name = deb.get("name", "DEBRIS")
                closest_debris_norad = deb.get("norad_id")

            if dist_km <= proximity_radius_km:
                deb_v = deb.get("velocity_vector")
                valid_sat_v = isinstance(sat_v, (list, tuple)) and len(sat_v) == 3 and all(isinstance(v, (int, float)) and math.isfinite(v) for v in sat_v)
                valid_deb_v = isinstance(deb_v, (list, tuple)) and len(deb_v) == 3 and all(isinstance(v, (int, float)) and math.isfinite(v) for v in deb_v)
                rel_v = self.compute_relative_velocity(sat_v, deb_v) if valid_sat_v and valid_deb_v else None
                nearby_debris.append({"norad_id": deb.get("norad_id"), "name": deb.get("name"), "distance_km": round(dist_km, 2), "rel_velocity_km_s": round(rel_v, 2) if rel_v is not None else None})

        nearby_count = len(nearby_debris)
        valid_speeds = [item["rel_velocity_km_s"] for item in nearby_debris if item["rel_velocity_km_s"] is not None]
        avg_rel_v = round(sum(valid_speeds) / len(valid_speeds), 2) if valid_speeds else None

        return {
            "norad_id": norad_id,
            "name": satellite.get("name"),
            "risk_score": None,
            "risk_level": "UNCLASSIFIED",
            "status_color": "gray",
            "nearby_debris_count": nearby_count,
            "avg_relative_velocity_km_s": avg_rel_v,
            "closest_debris_distance_km": round(closest_distance, 2) if math.isfinite(closest_distance) else None,
            "closest_debris_name": closest_debris_name,
            "closest_debris_norad": closest_debris_norad,
            "collision_probability": None,
            "collision_probability_is_heuristic": False,
            "metric": "instantaneous_catalog_proximity",
            "recommended_maneuver": None,
            "regime": satellite.get("regime"),
            "altitude_km": sat_alt,
            "country": satellite.get("country", "Unknown"),
            "inclination": satellite.get("inclination"),
        }

    def compute_all_risks(
        self,
        active_satellites: List[Dict[str, Any]],
        debris_list: List[Dict[str, Any]],
    ) -> Dict[str, Any]:
        """
        Compute available proximity counts and orbital shell catalog counts.
        """
        satellite_risks = []
        for sat in active_satellites:
            res = self.calculate_satellite_risk(sat, debris_list)
            satellite_risks.append(res)

        # Sort by catalog proximity count; this is not a collision-risk score.
        sorted_by_risk = sorted(satellite_risks, key=lambda x: x["nearby_debris_count"] or 0, reverse=True)
        top_10 = sorted_by_risk[:10]

        # Debris count by orbital shell
        leo_count = sum(1 for d in debris_list if isinstance(d.get("alt_km"), (int, float)) and d["alt_km"] < 2000)
        meo_count = sum(1 for d in debris_list if isinstance(d.get("alt_km"), (int, float)) and 2000 <= d["alt_km"] < 35786)
        geo_count = sum(1 for d in debris_list if isinstance(d.get("alt_km"), (int, float)) and d["alt_km"] >= 35786)

        shell_stats = [
            {"shell": "LEO (<2000 km)", "count": leo_count, "density": "Catalog count"},
            {"shell": "MEO (2000-35786 km)", "count": meo_count, "density": "Catalog count"},
            {"shell": "GEO (≥35786 km)", "count": geo_count, "density": "Catalog count"},
        ]

        # Generate a 2D catalog count grid (Altitude bins x Inclination bins)
        heatmap_grid = self._generate_heatmap(active_satellites + debris_list)

        return {
            "all_risks": {s["norad_id"]: s for s in satellite_risks},
            "top_10": top_10,
            "shell_stats": shell_stats,
            "heatmap": heatmap_grid,
            "total_debris_analyzed": len(debris_list),
            "total_active_analyzed": len(active_satellites),
        }

    def _generate_heatmap(self, all_objects: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        Compute density distribution matrix: Altitude bins (km) vs Inclination bins (deg).
        """
        alt_bins = [
            ("200-600 km", 200, 600),
            ("600-900 km", 600, 900),
            ("900-1400 km", 900, 1400),
            ("1400-2000 km", 1400, 2000),
            ("MEO (2000-35000 km)", 2000, 35000),
            ("GEO (35000+ km)", 35000, 50000),
        ]
        inc_bins = [
            ("0°-30° (Equatorial)", 0, 30),
            ("30°-60° (Mid-Inc)", 30, 60),
            ("60°-85° (High-Inc)", 60, 85),
            ("85°-105° (Polar/SSO)", 85, 105),
        ]

        grid = []
        for alt_label, alt_min, alt_max in alt_bins:
            for inc_label, inc_min, inc_max in inc_bins:
                count = sum(
                    1
                    for obj in all_objects
                    if isinstance(obj.get("alt_km"), (int, float))
                    and isinstance(obj.get("inclination"), (int, float))
                    and alt_min <= obj["alt_km"] < alt_max
                    and inc_min <= obj["inclination"] < inc_max
                )

                grid.append({
                    "altitude_bin": alt_label,
                    "inclination_bin": inc_label,
                    "object_count": count,
                    "density_level": "Count only",
                })

        return grid


# Module singleton
risk_engine = DebrisRiskEngine()
