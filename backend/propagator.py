"""
OrbitGuard SGP4 Propagator Engine
==================================
Propagates Earth satellite and debris Two-Line Element (TLE) sets in real time using Skyfield
and SGP4. Computes subpoints (latitude, longitude, altitude), velocity vectors, orbital elements,
and generates 3D trajectory polylines normalized for Three.js rendering.
"""

import logging
import math
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import numpy as np
from skyfield.api import EarthSatellite, load, wgs84
from skyfield.timelib import Time

logger = logging.getLogger("orbitguard.propagator")

EARTH_RADIUS_KM = 6378.137  # WGS84 equatorial radius
MU_EARTH = 398600.4418  # km^3/s^2


def classify_country(name: str, norad_id: int) -> str:
    """Infer country or operating agency from satellite name and metadata."""
    name_upper = name.upper()
    if any(k in name_upper for k in ["ISRO", "CARTOSAT", "RISAT", "GSAT", "INSAT", "NAVIC", "IRNSS", "EOS-", "CHANDRAYAAN", "MOM"]):
        return "India (ISRO)"
    if any(k in name_upper for k in ["STARLINK", "USA", "GPS", "NOAA", "HST", "HUBBLE", "TERRA", "AQUA", "LANDSAT", "GOES", "ATLAS", "DELTA", "CYGNUS", "DRAGON"]):
        return "United States"
    if any(k in name_upper for k in ["COSMOS", "SOYUZ", "GLONASS", "PROGRESS", "SL-", "BREEZE", "MOLNIYA", "ZENIT"]):
        return "Russia"
    if any(k in name_upper for k in ["TIANGONG", "FENGYUN", "CZ-", "CHANG'E", "SHENZHOU", "BEIDOU", "YAOGAN", "GAOFEN"]):
        return "China"
    if any(k in name_upper for k in ["SENTINEL", "GALILEO", "ENVISAT", "METEOSAT", "ARIANE", "METOP", "SPOT"]):
        return "ESA / Europe"
    if any(k in name_upper for k in ["ONEWEB"]):
        return "United Kingdom"
    if any(k in name_upper for k in ["ALOS", "H-II", "H-2", "HIMAWARI", "QZS"]):
        return "Japan"
    return "International"


def classify_object_type(name: str) -> str:
    """Identify object classification: Satellite, Debris, or Rocket Body."""
    name_upper = name.upper()
    if "DEB" in name_upper or "DEBRIS" in name_upper:
        return "Debris"
    if "R/B" in name_upper or "ROCKET" in name_upper or "STAGE" in name_upper or "CENTAUR" in name_upper:
        return "Rocket Body"
    return "Satellite"


def lat_lon_alt_to_cartesian(lat_deg: float, lon_deg: float, alt_km: float) -> List[float]:
    """
    Convert spherical coordinates (lat, lon, alt) to Cartesian [x, y, z]
    normalized to Three.js globe coordinates (Earth Radius = 1.0 unit).
    Matches Three.js standard Sphere UV mapping:
      x = r * cos(lat) * sin(lon)
      y = r * sin(lat)
      z = r * cos(lat) * cos(lon)
    """
    lat_rad = math.radians(lat_deg)
    lon_rad = math.radians(lon_deg)
    r = (EARTH_RADIUS_KM + alt_km) / EARTH_RADIUS_KM

    x = r * math.cos(lat_rad) * math.sin(lon_rad)
    y = r * math.sin(lat_rad)
    z = r * math.cos(lat_rad) * math.cos(lon_rad)
    return [round(x, 5), round(y, 5), round(z, 5)]


class SatellitePropagator:
    """
    High-performance SGP4 satellite propagation engine using Skyfield timescale.
    """

    def __init__(self):
        self.ts = load.timescale()
        self._active_cache: Dict[str, Any] = {}
        self._debris_cache: Dict[str, Any] = {}
        self._last_prop_time = 0.0
        self._tle_cache: Dict[str, Tuple[float, List[EarthSatellite]]] = {}

    def parse_tle_file(self, file_path: Path) -> List[EarthSatellite]:
        """Cached (by mtime) wrapper: avoids re-parsing the TLE file on every API request."""
        try:
            mtime = Path(file_path).stat().st_mtime
        except OSError:
            return []
        key = str(file_path)
        cached = self._tle_cache.get(key)
        if cached and cached[0] == mtime:
            return list(cached[1])
        sats = self._parse_tle_file_uncached(Path(file_path))
        self._tle_cache[key] = (mtime, sats)
        return list(sats)

    def _parse_tle_file_uncached(self, file_path: Path) -> List[EarthSatellite]:
        """Parse 3-line or 2-line TLE file into Skyfield EarthSatellite objects."""
        if not file_path.exists():
            return []

        satellites = []
        with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
            lines = [line.strip() for line in f if line.strip()]

        i = 0
        while i < len(lines):
            line = lines[i]
            if line.startswith("1 ") and i + 1 < len(lines) and lines[i + 1].startswith("2 "):
                # 2-line element
                name = f"OBJECT-{line[2:7].strip()}"
                try:
                    sat = EarthSatellite(line, lines[i + 1], name, self.ts)
                    satellites.append(sat)
                except Exception as e:
                    logger.debug(f"Failed parsing 2-line TLE: {e}")
                i += 2
            elif i + 2 < len(lines) and lines[i + 1].startswith("1 ") and lines[i + 2].startswith("2 "):
                # Standard 3-line element: Name, Line 1, Line 2
                name = line
                try:
                    sat = EarthSatellite(lines[i + 1], lines[i + 2], name, self.ts)
                    satellites.append(sat)
                except Exception as e:
                    logger.debug(f"Failed parsing 3-line TLE for {name}: {e}")
                i += 3
            else:
                i += 1

        return satellites

    def propagate_satellite(self, sat: EarthSatellite, t: Optional[Time] = None) -> Optional[Dict[str, Any]]:
        """
        Propagate single satellite to given time `t` (defaults to current UTC).
        Computes subpoint, velocity, orbital elements, and 3D position.
        """
        if t is None:
            t = self.ts.now()

        try:
            geocentric = sat.at(t)
            subpoint = wgs84.subpoint(geocentric)

            lat = float(subpoint.latitude.degrees)
            lon = float(subpoint.longitude.degrees)
            alt = float(subpoint.elevation.km)

            # Velocity vector in km/s
            v_vec = geocentric.velocity.km_per_s
            speed = float(np.linalg.norm(v_vec))

            # Orbital elements from SGP4 model
            model = sat.model
            mean_motion_rev_day = float(model.no_kozai * 1440.0 / (2.0 * math.pi))
            period_min = round(1440.0 / mean_motion_rev_day, 2) if mean_motion_rev_day > 0 else 0.0
            inclination = round(float(math.degrees(model.inclo)), 2)
            eccentricity = round(float(model.ecco), 5)

            # Perigee / apogee altitude from the element set: a = (mu / n^2)^(1/3)
            n_rad_s = float(model.no_kozai) / 60.0  # no_kozai is rad/min
            if n_rad_s > 0:
                sma_km = (MU_EARTH / (n_rad_s * n_rad_s)) ** (1.0 / 3.0)
                perigee_km = round(sma_km * (1.0 - eccentricity) - EARTH_RADIUS_KM, 1)
                apogee_km = round(sma_km * (1.0 + eccentricity) - EARTH_RADIUS_KM, 1)
            else:
                perigee_km = apogee_km = round(alt, 1)
            mean_alt = 0.5 * (perigee_km + apogee_km)

            norad_id = int(model.satnum)
            name = sat.name or f"OBJECT {norad_id}"
            obj_type = classify_object_type(name)
            country = classify_country(name, norad_id)

            # Orbital regime classification
            if eccentricity >= 0.25 and apogee_km > 2000.0:
                regime = "HEO"
            elif mean_alt < 2000.0:
                regime = "LEO"
            elif mean_alt < 35786.0 - 500.0:
                regime = "MEO"
            elif abs(mean_alt - 35786.0) <= 1000.0 and eccentricity < 0.05:
                regime = "GEO"
            else:
                regime = "HEO"

            cartesian = lat_lon_alt_to_cartesian(lat, lon, alt)

            return {
                "norad_id": norad_id,
                "name": name,
                "lat": round(lat, 4),
                "lon": round(lon, 4),
                "alt_km": round(alt, 2),
                "velocity_km_s": round(speed, 2),
                "velocity_vector": [round(float(v), 2) for v in v_vec],
                "inclination": inclination,
                "period_min": period_min,
                "eccentricity": eccentricity,
                "perigee_km": perigee_km,
                "apogee_km": apogee_km,
                "regime": regime,
                "object_type": obj_type,
                "country": country,
                "cartesian": cartesian,
                "epoch": str(sat.epoch.utc_iso()),
            }
        except Exception as exc:
            logger.debug(f"Propagation error for sat {sat.name}: {exc}")
            return None

    def compute_orbit_path(self, sat: EarthSatellite, num_points: int = 180) -> List[List[float]]:
        """
        Sample `num_points` positions along one complete orbital revolution of `sat`.
        Returns a list of Cartesian coordinates [[x, y, z], ...] for 3D path rendering.
        """
        try:
            model = sat.model
            mean_motion_rev_day = float(model.no_kozai * 1440.0 / (2.0 * math.pi))
            if mean_motion_rev_day <= 0:
                period_days = 1.0 / 15.0  # fallback ~96 min
            else:
                period_days = 1.0 / mean_motion_rev_day

            now_t = self.ts.now()
            # Generate sample time intervals over one period
            time_steps = [now_t.tt + (step / num_points) * period_days for step in range(num_points + 1)]
            times = self.ts.tt_jd(time_steps)

            geocentrics = sat.at(times)
            subpoints = wgs84.subpoint(geocentrics)

            lats = subpoints.latitude.degrees
            lons = subpoints.longitude.degrees
            alts = subpoints.elevation.km

            path_points = []
            for lat, lon, alt in zip(lats, lons, alts):
                path_points.append(lat_lon_alt_to_cartesian(float(lat), float(lon), float(alt)))

            return path_points
        except Exception as exc:
            logger.warning(f"Error computing orbit path for {sat.name}: {exc}")
            return []

    def propagate_catalog(self, file_path: Path, limit: Optional[int] = None) -> List[Dict[str, Any]]:
        """Propagate all objects in a TLE file."""
        satellites = self.parse_tle_file(file_path)
        if limit and limit > 0:
            satellites = satellites[:limit]

        now_t = self.ts.now()
        results = []
        for sat in satellites:
            data = self.propagate_satellite(sat, now_t)
            if data:
                results.append(data)
        return results


# Module singleton
propagator = SatellitePropagator()
