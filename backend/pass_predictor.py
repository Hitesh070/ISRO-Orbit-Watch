"""
OrbitGuard Ground Station Pass Predictor
=========================================
Predicts satellite pass opportunities (AOS, Culmination/Max Elevation, LOS)
over user-specified ground stations and geographic coordinates using Skyfield's find_events.
Requires explicit observer coordinates and altitude above mean sea level and generates
2D ground track coordinate trajectories. No unverified station presets are published.
"""

import logging
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

from skyfield.api import EarthSatellite, load, wgs84

logger = logging.getLogger("orbitguard.pass_predictor")

# No preset coordinates are published until verified against authoritative station records.
FAMOUS_GROUND_STATIONS = {}


def compass_direction(az_deg: float) -> str:
    """Convert azimuth degrees into 8-point compass notation."""
    points = ["N", "NE", "E", "SE", "S", "SW", "W", "NW", "N"]
    idx = int((az_deg + 22.5) / 45.0) % 8
    return points[idx]


class PassPredictor:
    """
    Computes upcoming passes and ground tracks for satellites over ground stations.
    """

    def __init__(self):
        self.ts = load.timescale()

    def resolve_location(self, city_or_key: str, lat: Optional[float] = None, lon: Optional[float] = None, alt_m: Optional[float] = None) -> Dict[str, Any]:
        """Resolve fully specified observer coordinates; reject unknown location names."""
        key = (city_or_key or "").lower().strip()
        if key in FAMOUS_GROUND_STATIONS:
            return FAMOUS_GROUND_STATIONS[key]

        if "," in key:
            try:
                parts = key.split(",")
                p_lat = float(parts[0].strip())
                p_lon = float(parts[1].strip())
                if len(parts) < 3:
                    raise ValueError("Custom coordinates require latitude, longitude, and altitude in meters.")
                p_alt = float(parts[2].strip())
                if not (-90 <= p_lat <= 90 and -180 <= p_lon <= 180 and -500 <= p_alt <= 10000):
                    raise ValueError("Custom location coordinates or altitude are outside the supported range.")
                return {
                    "name": f"Custom Ground Station ({p_lat:.2f}°, {p_lon:.2f}°)",
                    "city": "Custom GPS",
                    "country": "User Specified",
                    "lat": p_lat,
                    "lon": p_lon,
                    "alt_m": p_alt,
                }
            except Exception:
                pass

        for station in FAMOUS_GROUND_STATIONS.values():
            if key and key in {station["city"].lower(), station["name"].lower()}:
                return station

        if lat is None or lon is None or alt_m is None:
            raise ValueError("Unknown station. Provide a configured station name or latitude, longitude, and altitude in meters.")
        if not (-90 <= lat <= 90 and -180 <= lon <= 180 and -500 <= alt_m <= 10000):
            raise ValueError("Custom location coordinates or altitude are outside the supported range.")
        final_lat = lat
        final_lon = lon
        return {
            "name": f"Custom Ground Station ({final_lat:.2f}°, {final_lon:.2f}°)",
            "city": city_or_key or "Custom Location",
            "country": "User Specified",
            "lat": final_lat,
            "lon": final_lon,
            "alt_m": alt_m,
        }

    def predict_passes(
        self,
        satellite: EarthSatellite,
        lat: float,
        lon: float,
        alt_m: float,
        days: int = 5,
        min_elevation_deg: float = 10.0,
        max_results: int = 10,
    ) -> List[Dict[str, Any]]:
        """
        Calculate the next `max_results` pass opportunities of `satellite`
        over given latitude/longitude.
        """
        ground_loc = wgs84.latlon(lat, lon, elevation_m=alt_m)
        now_dt = datetime.now(timezone.utc)
        t0 = self.ts.from_datetime(now_dt)
        t1 = self.ts.from_datetime(now_dt + timedelta(days=days))

        times, events = satellite.find_events(ground_loc, t0, t1, altitude_degrees=min_elevation_deg)

        passes = []
        current_pass: Dict[str, Any] = {}

        for t, event in zip(times, events):
            difference = satellite - ground_loc
            topocentric = difference.at(t)
            alt, az, dist = topocentric.altaz()
            dt_iso = t.utc_datetime().strftime("%Y-%m-%dT%H:%M:%SZ")

            if event == 0:  # AOS (Acquisition of Signal - rise above min_elevation)
                aos_dir = compass_direction(float(az.degrees))
                if isinstance(aos_dir, (tuple, list)):
                    aos_dir = aos_dir[0]
                current_pass = {
                    "aos_time": dt_iso,
                    "aos_azimuth": round(float(az.degrees), 1),
                    "aos_direction": str(aos_dir),
                }
            elif event == 1 and current_pass:  # Culmination (Max Elevation)
                current_pass["culmination_time"] = dt_iso
                current_pass["max_elevation"] = round(float(alt.degrees), 1)
                current_pass["culmination_azimuth"] = round(float(az.degrees), 1)
                current_pass["distance_km"] = round(float(dist.km), 1)
            elif event == 2 and current_pass:  # LOS (Loss of Signal - sets)
                current_pass["los_time"] = dt_iso
                current_pass["los_azimuth"] = round(float(az.degrees), 1)
                los_dir = compass_direction(float(az.degrees))
                if isinstance(los_dir, (tuple, list)):
                    los_dir = los_dir[0]
                current_pass["los_direction"] = str(los_dir)

                # Compute pass duration in seconds
                try:
                    aos_dt = datetime.strptime(current_pass["aos_time"], "%Y-%m-%dT%H:%M:%SZ")
                    los_dt = datetime.strptime(current_pass["los_time"], "%Y-%m-%dT%H:%M:%SZ")
                    duration_sec = int((los_dt - aos_dt).total_seconds())
                    duration_str = f"{duration_sec // 60}m {duration_sec % 60}s"
                except Exception:
                    duration_sec = 0
                    duration_str = "N/A"

                current_pass["duration_seconds"] = duration_sec
                current_pass["duration"] = duration_str
                current_pass["trajectory_summary"] = f"{current_pass.get('aos_direction', 'N')} → {current_pass.get('los_direction', 'S')}"

                # Quality rating based on max elevation
                max_el = current_pass.get("max_elevation", 0)
                if max_el >= 50:
                    quality = "EXCELLENT"
                elif max_el >= 25:
                    quality = "GOOD"
                else:
                    quality = "FAIR"
                current_pass["quality"] = quality

                passes.append(current_pass)
                current_pass = {}

                if len(passes) >= max_results:
                    break

        return passes

    def compute_ground_track(
        self,
        satellite: EarthSatellite,
        past_minutes: int = 45,
        future_minutes: int = 45,
        step_minutes: int = 2,
    ) -> List[Dict[str, Any]]:
        """
        Generate 2D ground track (lat/lon points) for one orbital revolution
        spanning past and future time from current epoch.
        """
        now_dt = datetime.now(timezone.utc)
        start_dt = now_dt - timedelta(minutes=past_minutes)
        total_steps = int((past_minutes + future_minutes) / step_minutes)

        time_jds = [self.ts.from_datetime(start_dt + timedelta(minutes=i * step_minutes)).tt for i in range(total_steps + 1)]
        times = self.ts.tt_jd(time_jds)

        geocentrics = satellite.at(times)
        subpoints = wgs84.subpoint(geocentrics)

        lats = subpoints.latitude.degrees
        lons = subpoints.longitude.degrees
        alts = subpoints.elevation.km

        points = []
        for i, (lat, lon, alt) in enumerate(zip(lats, lons, alts)):
            pt_dt = start_dt + timedelta(minutes=i * step_minutes)
            points.append({
                "lat": round(float(lat), 4),
                "lon": round(float(lon), 4),
                "alt_km": round(float(alt), 1),
                "timestamp": pt_dt.strftime("%H:%M:%S"),
                "is_current": abs((pt_dt - now_dt).total_seconds()) < (step_minutes * 60 / 2),
            })

        return points


# Module singleton
pass_predictor = PassPredictor()
