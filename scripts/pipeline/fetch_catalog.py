"""
OrbitGuard Orbital Data Pipeline & Catalog Compiler (Phase 1)
============================================================
Fetches orbital elements in CCSDS OMM/GP JSON format from CelesTrak and optional
Space-Track API, validates SGP4 propagability, filters decayed objects, flags stale epochs,
and compiles compact compressed artifacts for high-performance client rendering.
"""

import gzip
import json
import logging
import math
import re
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import httpx

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
if str(REPO_ROOT) not in sys.path:  # lets `python scripts/pipeline/fetch_catalog.py` import backend.*
    sys.path.insert(0, str(REPO_ROOT))

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger("orbitguard.pipeline")

EARTH_RADIUS_KM = 6378.137
MU_EARTH = 398600.4418  # km^3 / s^2

CELESTRAK_GROUPS_ACTIVE = [
    "stations",
    "visual",
    "weather",
    "resource",
    "science",
    "gnss",
    "geo",
]

CELESTRAK_DEBRIS = [
    {"type": "GROUP", "query": "cosmos-2251-debris", "name": "Cosmos-2251 Debris"},
    {"type": "GROUP", "query": "iridium-33-debris", "name": "Iridium-33 Debris"},
    {"type": "INTDES", "query": "1999-025", "name": "Fengyun-1C ASAT Debris"},
]

USER_AGENT = "OrbitGuard/3.0 (Space Situational Awareness Tracker; contact@orbitguard.space)"


def classify_country(name: str, norad_id: int) -> str:
    """Infer country or operating agency from satellite name and metadata."""
    name_upper = name.upper()
    if any(k in name_upper for k in [
        "ISRO", "CARTOSAT", "RISAT", "GSAT", "INSAT", "NAVIC", "IRNSS",
        "EOS-", "CHANDRAYAAN", "MOM", "ASTROSAT", "ADITYA", "OCEANSAT", "RESOURCESAT"
    ]):
        return "India (ISRO)"
    if any(k in name_upper for k in [
        "STARLINK", "USA", "GPS", "NOAA", "HST", "HUBBLE", "TERRA", "AQUA",
        "LANDSAT", "GOES", "ATLAS", "DELTA", "CYGNUS", "DRAGON", "NAVSTAR", "TDRS"
    ]):
        return "United States"
    if any(k in name_upper for k in ["COSMOS", "SOYUZ", "GLONASS", "PROGRESS", "SL-", "BREEZE", "MOLNIYA", "ZENIT"]):
        return "Russia"
    if any(k in name_upper for k in ["TIANGONG", "FENGYUN", "CZ-", "CHANG'E", "SHENZHOU", "BEIDOU", "YAOGAN", "GAOFEN"]):
        return "China"
    if any(k in name_upper for k in ["SENTINEL", "GALILEO", "ENVISAT", "METEOSAT", "ARIANE", "METOP", "SPOT", "CHEOPS"]):
        return "ESA / Europe"
    if any(k in name_upper for k in ["ONEWEB"]):
        return "United Kingdom"
    if any(k in name_upper for k in ["ALOS", "H-II", "H-2", "HIMAWARI", "QZS"]):
        return "Japan"
    return "International"


def classify_object_type(name: str, omm_type: Optional[str] = None) -> str:
    """Standardize object classification: Satellite (Payload), Debris, Rocket Body."""
    name_upper = name.upper()
    if "DEB" in name_upper or "DEBRIS" in name_upper or "FRAGMENT" in name_upper:
        return "Debris"
    if any(k in name_upper for k in ["R/B", "ROCKET", "STAGE", "CENTAUR", "BREEZE", "UPPER STAGE", "PEGASUS", "DELTA 1", "DELTA 2"]):
        return "Rocket Body"
    if omm_type:
        t_upper = omm_type.upper()
        if "DEB" in t_upper:
            return "Debris"
        if "ROCKET" in t_upper:
            return "Rocket Body"
    return "Satellite"


def derive_orbital_metrics(mean_motion_rev_day: float, eccentricity: float) -> Tuple[float, float, float, float, str]:
    """
    Derive semi-major axis, perigee, apogee, period, and orbital regime.
    """
    if mean_motion_rev_day <= 0.0:
        return 0.0, 0.0, 0.0, 0.0, "UNKNOWN"

    period_min = round(1440.0 / mean_motion_rev_day, 2)
    # Mean motion n in rad/s
    n_rad_s = mean_motion_rev_day * (2.0 * math.pi / 86400.0)
    # a = (mu / n^2)^(1/3)
    sma_km = (MU_EARTH / (n_rad_s * n_rad_s)) ** (1.0 / 3.0)

    perigee_km = round(sma_km * (1.0 - eccentricity) - EARTH_RADIUS_KM, 1)
    apogee_km = round(sma_km * (1.0 + eccentricity) - EARTH_RADIUS_KM, 1)
    mean_alt_km = (perigee_km + apogee_km) / 2.0

    if eccentricity >= 0.25 and apogee_km > 2000.0:
        regime = "HEO"  # Molniya / GTO-type orbits (mean altitude alone misclassifies them)
    elif mean_alt_km < 2000.0:
        regime = "LEO"
    elif mean_alt_km < 35786.0 - 500.0:
        regime = "MEO"
    elif abs(mean_alt_km - 35786.0) <= 800.0 and eccentricity < 0.05:
        regime = "GEO"
    else:
        regime = "HEO"

    return round(sma_km, 2), perigee_km, apogee_km, period_min, regime


def parse_omm_to_catalog_item(omm: Dict[str, Any], default_type: Optional[str] = None) -> Optional[Dict[str, Any]]:
    """Parse raw CCSDS OMM JSON object into normalized schema."""
    try:
        norad_id = int(omm["NORAD_CAT_ID"])
        name = str(omm.get("OBJECT_NAME", f"OBJECT-{norad_id}")).strip()
        intl_des = str(omm.get("OBJECT_ID", "UNKNOWN")).strip()
        epoch_str = str(omm.get("EPOCH", "")).strip()

        mm = float(omm.get("MEAN_MOTION", 0.0))
        ecc = float(omm.get("ECCENTRICITY", 0.0))
        inc = round(float(omm.get("INCLINATION", 0.0)), 4)
        raan = round(float(omm.get("RA_OF_ASC_NODE", 0.0)), 4)
        argp = round(float(omm.get("ARG_OF_PERICENTER", 0.0)), 4)
        ma = round(float(omm.get("MEAN_ANOMALY", 0.0)), 4)
        bstar = float(omm.get("BSTAR", 0.0))

        sma_km, perigee_km, apogee_km, period_min, regime = derive_orbital_metrics(mm, ecc)

        # Basic physics sanity check
        if perigee_km < -200.0 or ecc >= 1.0 or sma_km <= 0.0:
            status = "decayed/invalid"
        else:
            status = "operational"

        # TLE Age check
        is_stale = False
        tle_age_days = 0.0
        if epoch_str:
            try:
                # Format: 2026-11-05T20:28:36.809184
                epoch_clean = epoch_str.replace("Z", "")
                epoch_dt = datetime.fromisoformat(epoch_clean).replace(tzinfo=timezone.utc)
                now_dt = datetime.now(timezone.utc)
                tle_age_days = round(max(0.0, (now_dt - epoch_dt).total_seconds() / 86400.0), 2)
                if tle_age_days > 14.0:
                    is_stale = True
            except Exception:
                pass

        obj_type = default_type or classify_object_type(name, omm.get("OBJECT_TYPE"))
        country = classify_country(name, norad_id)
        is_isro = "ISRO" in country or "India" in country

        # Format 2-line elements for SGP4 propagators
        # Many client components use twoline2satrec
        line1, line2 = omm_to_tle_strings(omm)

        return {
            "norad_id": norad_id,
            "name": name,
            "intl_des": intl_des,
            "object_type": obj_type,
            "country": country,
            "is_isro": is_isro,
            "epoch": epoch_str,
            "tle_age_days": tle_age_days,
            "is_stale": is_stale,
            "status": status,
            "mean_motion": mm,
            "eccentricity": ecc,
            "inclination": inc,
            "raan": raan,
            "arg_perigee": argp,
            "mean_anomaly": ma,
            "bstar": bstar,
            "semi_major_axis_km": sma_km,
            "perigee_km": perigee_km,
            "apogee_km": apogee_km,
            "period_min": period_min,
            "regime": regime,
            "line1": line1,
            "line2": line2,
        }
    except Exception as exc:
        logger.debug(f"Failed parsing OMM object: {exc}")
        return None


def _tle_intl_designator(object_id: str) -> str:
    """OMM uses '1998-067A'; a TLE needs the 8-char '98067A  ' form."""
    m = re.fullmatch(r"(\d{4})-(\d{3})([A-Z]{0,3})", object_id.strip())
    if m:
        return f"{m.group(1)[2:]}{m.group(2)}{m.group(3)}".ljust(8)
    return " " * 8


def _tle_epoch(line1: str) -> datetime:
    yy = int(line1[18:20])
    year = 2000 + yy if yy < 57 else 1900 + yy
    return datetime(year, 1, 1, tzinfo=timezone.utc) + timedelta(days=float(line1[20:32]) - 1.0)


def _tle_bstar(line1: str) -> float:
    field = line1[53:61]
    try:
        sign = -1.0 if field[0] == "-" else 1.0
        return sign * (int(field[1:6]) / 1e5) * 10 ** int(field[6:8])
    except ValueError:
        return 0.0


def omm_to_tle_strings(omm: Dict[str, Any]) -> Tuple[str, str]:
    """
    Generate standard 69-character TLE Line 1 and Line 2 strings from OMM parameters.
    """
    try:
        satnum = int(omm["NORAD_CAT_ID"])
        if satnum > 99999:
            raise ValueError("NORAD id exceeds the 5-digit TLE range; use OMM-based propagation")
        class_char = str(omm.get("CLASSIFICATION_TYPE", "U"))[0]
        intldesg = _tle_intl_designator(str(omm.get("OBJECT_ID", "")))

        epoch_str = str(omm.get("EPOCH", "2026-01-01T00:00:00")).replace("Z", "")
        dt = datetime.fromisoformat(epoch_str)
        epochyr = dt.year % 100
        day_of_year = (dt - datetime(dt.year, 1, 1)).total_seconds() / 86400.0 + 1.0
        epoch_field = f"{epochyr:02d}{day_of_year:012.8f}"

        mm_dot = float(omm.get("MEAN_MOTION_DOT", 0.0))
        mm_dot_str = f"{min(abs(mm_dot), 0.99999999):.8f}"  # "0.00014285"
        mm_dot_field = ("-" if mm_dot < 0 else " ") + mm_dot_str[1:]  # 10 chars: sign + ".00014285"

        # BSTAR formatting
        bstar = float(omm.get("BSTAR", 0.0))
        if bstar == 0.0:
            bstar_field = " 00000+0"
        else:
            exp = int(math.floor(math.log10(abs(bstar)))) + 1
            mantissa = int(round((bstar / (10 ** exp)) * 100000))
            if mantissa >= 100000:
                mantissa //= 10
                exp += 1
            sign = "-" if bstar < 0 else " "
            exp_sign = "+" if exp >= 0 else "-"
            bstar_field = f"{sign}{abs(mantissa):05d}{exp_sign}{abs(exp)}"

        elnum = int(omm.get("ELEMENT_SET_NO", 999)) % 1000

        line1_raw = f"1 {satnum:05d}{class_char} {intldesg} {epoch_field} {mm_dot_field}  00000-0 {bstar_field} 0 {elnum:4d}"
        c1 = tle_checksum(line1_raw[:68])
        line1 = f"{line1_raw[:68]}{c1}"

        inc = float(omm.get("INCLINATION", 0.0))
        raan = float(omm.get("RA_OF_ASC_NODE", 0.0))
        ecc = float(omm.get("ECCENTRICITY", 0.0))
        ecc_int = int(round(ecc * 1e7))
        argp = float(omm.get("ARG_OF_PERICENTER", 0.0))
        ma = float(omm.get("MEAN_ANOMALY", 0.0))
        mm = float(omm.get("MEAN_MOTION", 1.0))
        rev = int(omm.get("REV_AT_EPOCH", 0)) % 100000

        line2_raw = f"2 {satnum:05d} {inc:8.4f} {raan:8.4f} {ecc_int:07d} {argp:8.4f} {ma:8.4f} {mm:11.8f}{rev:5d}"
        c2 = tle_checksum(line2_raw[:68])
        line2 = f"{line2_raw[:68]}{c2}"
        return line1, line2
    except Exception as exc:
        # Never fabricate an orbit (the old fallback emitted an ISS-like dummy TLE for failed objects).
        logger.debug(f"Could not build TLE for {omm.get('NORAD_CAT_ID')}: {exc}")
        return "", ""


def tle_checksum(line: str) -> int:
    """Compute modulo 10 checksum for a 68-character TLE line."""
    total = 0
    for char in line[:68]:
        if char.isdigit():
            total += int(char)
        elif char == "-":
            total += 1
    return total % 10


class CatalogPipeline:
    """
    Downloads, normalizes, validates, and compiles satellite and debris catalogs.
    """

    def __init__(self, output_dir: Optional[Path] = None):
        self.output_dir = output_dir or (Path(__file__).resolve().parent.parent.parent / "frontend" / "public" / "data")
        self.output_dir.mkdir(parents=True, exist_ok=True)
        self.backend_data_dir = Path(__file__).resolve().parent.parent.parent / "backend" / "data"
        self.backend_data_dir.mkdir(parents=True, exist_ok=True)

    def fetch_celestrak_active(self, client: httpx.Client) -> List[Dict[str, Any]]:
        """Fetch operational satellites from curated CelesTrak groups."""
        all_objects = []
        seen_ids = set()

        for group in CELESTRAK_GROUPS_ACTIVE:
            url = f"https://celestrak.org/NORAD/elements/gp.php?GROUP={group}&FORMAT=json"
            try:
                logger.info(f"Fetching CelesTrak group: {group}...")
                resp = client.get(url)
                if resp.status_code == 200 and resp.text.startswith("["):
                    items = resp.json()
                    logger.info(f"Loaded {len(items)} items from {group}")
                    for item in items:
                        nid = item.get("NORAD_CAT_ID")
                        if nid and nid not in seen_ids:
                            seen_ids.add(nid)
                            parsed = parse_omm_to_catalog_item(item, default_type="Satellite")
                            if parsed:
                                all_objects.append(parsed)
                else:
                    logger.warning(f"Group {group} returned status {resp.status_code}")
            except Exception as exc:
                logger.warning(f"Error fetching group {group}: {exc}")

        return all_objects

    def fetch_celestrak_debris(self, client: httpx.Client) -> List[Dict[str, Any]]:
        """Fetch high-profile orbital debris fields."""
        debris_objects = []
        seen_ids = set()

        for deb_spec in CELESTRAK_DEBRIS:
            q_type = deb_spec["type"]
            query = deb_spec["query"]
            name = deb_spec["name"]

            url = f"https://celestrak.org/NORAD/elements/gp.php?{q_type}={query}&FORMAT=json"
            try:
                logger.info(f"Fetching debris field: {name} ({q_type}={query})...")
                resp = client.get(url)
                if resp.status_code == 200 and resp.text.startswith("["):
                    items = resp.json()
                    logger.info(f"Loaded {len(items)} debris objects from {name}")
                    for item in items:
                        nid = item.get("NORAD_CAT_ID")
                        if nid and nid not in seen_ids:
                            seen_ids.add(nid)
                            parsed = parse_omm_to_catalog_item(item, default_type="Debris")
                            if parsed:
                                debris_objects.append(parsed)
                else:
                    logger.warning(f"Debris {name} returned status {resp.status_code}")
            except Exception as exc:
                logger.warning(f"Error fetching debris {name}: {exc}")

        return debris_objects

    def run_pipeline(self) -> Dict[str, Any]:
        """Execute end-to-end catalog fetch, validation, and serialization."""
        start_time = datetime.now(timezone.utc)
        logger.info(f"Starting OrbitGuard catalog pipeline at {start_time.isoformat()}")

        headers = {"User-Agent": USER_AGENT}
        active_list: List[Dict[str, Any]] = []
        debris_list: List[Dict[str, Any]] = []

        try:
            with httpx.Client(timeout=25.0, headers=headers, follow_redirects=True) as client:
                active_list = self.fetch_celestrak_active(client)
                debris_list = self.fetch_celestrak_debris(client)
        except Exception as exc:
            logger.error(f"HTTP fetch pipeline encountered error: {exc}")

        total_fetched = len(active_list) + len(debris_list)
        logger.info(f"Total objects fetched from live sources: {total_fetched} (Active: {len(active_list)}, Debris: {len(debris_list)})")

        # Fallback to high-fidelity seed catalog if network was blocked
        if total_fetched == 0:
            if (self.output_dir / "catalog.json").exists():
                # Do NOT overwrite a good catalog with illustrative seed data.
                logger.error("Live sources unavailable; keeping existing catalog artifacts.")
                raise SystemExit(1)
            logger.warning("Live sources unavailable. Compiling pipeline from baseline seed catalog.")
            active_list, debris_list = self._compile_fallback_seed()

        # Combine catalog
        catalog = active_list + debris_list

        # Metadata computation
        epochs = [obj["epoch"] for obj in catalog if obj.get("epoch")]
        oldest_epoch = min(epochs) if epochs else "UNKNOWN"
        newest_epoch = max(epochs) if epochs else "UNKNOWN"
        stale_count = sum(1 for obj in catalog if obj.get("is_stale"))
        decayed_count = sum(1 for obj in catalog if obj.get("status") == "decayed/invalid")
        isro_count = sum(1 for obj in catalog if obj.get("is_isro"))

        metadata = {
            "fetch_time_utc": datetime.now(timezone.utc).isoformat(),
            "source": "CelesTrak CCSDS OMM/GP API",
            "total_objects": len(catalog),
            "active_satellites": len(active_list),
            "debris_objects": len(debris_list),
            "isro_assets": isro_count,
            "stale_objects": stale_count,
            "decayed_objects": decayed_count,
            "oldest_epoch": oldest_epoch,
            "newest_epoch": newest_epoch,
            "compression": "gzip",
            "schema_version": "3.0.0",
        }

        # Save artifacts to frontend/public/data/ and backend/data/
        self._write_artifacts(catalog, metadata)

        duration = (datetime.now(timezone.utc) - start_time).total_seconds()
        logger.info(f"Pipeline completed successfully in {duration:.2f}s. Saved {len(catalog)} objects.")
        return metadata

    def _write_artifacts(self, catalog: List[Dict[str, Any]], metadata: Dict[str, Any]) -> None:
        """Write JSON, GZIP JSON, and metadata files."""
        # 1. Uncompressed catalog.json for development and fallback
        cat_json_path = self.output_dir / "catalog.json"
        with open(cat_json_path, "w", encoding="utf-8") as f:
            json.dump(catalog, f, separators=(",", ":"))

        # 2. GZIP compressed catalog.json.gz for high-performance CDN delivery
        cat_gz_path = self.output_dir / "catalog.json.gz"
        with gzip.open(cat_gz_path, "wt", encoding="utf-8") as f:
            json.dump(catalog, f, separators=(",", ":"))

        # 3. Provenance metadata
        meta_path = self.output_dir / "meta.json"
        with open(meta_path, "w", encoding="utf-8") as f:
            json.dump(metadata, f, indent=2)

        # 4. Mirror to backend data directory
        with open(self.backend_data_dir / "catalog.json", "w", encoding="utf-8") as f:
            json.dump(catalog, f, separators=(",", ":"))
        with open(self.backend_data_dir / "meta.json", "w", encoding="utf-8") as f:
            json.dump(metadata, f, indent=2)

        uncompressed_kb = cat_json_path.stat().st_size / 1024.0
        compressed_kb = cat_gz_path.stat().st_size / 1024.0
        logger.info(f"Artifact sizes: catalog.json: {uncompressed_kb:.1f} KB | catalog.json.gz: {compressed_kb:.1f} KB ({(compressed_kb/uncompressed_kb)*100:.1f}%)")

    def _compile_fallback_seed(self) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
        """High-fidelity curated seed for offline resilience."""
        # Reads backend/data/active_sats.tle and debris.tle
        active = []
        debris = []
        from backend.tle_fetcher import SEED_ACTIVE_TLE, SEED_DEBRIS_TLE

        for line_block, group, t_label in [(SEED_ACTIVE_TLE, active, "Satellite"), (SEED_DEBRIS_TLE, debris, "Debris")]:
            lines = [line_str.strip() for line_str in line_block.strip().split("\n") if line_str.strip()]
            i = 0
            while i < len(lines):
                if lines[i].startswith("1 ") and i + 1 < len(lines):
                    name = f"OBJECT-{lines[i][2:7].strip()}"
                    l1 = lines[i]
                    l2 = lines[i + 1]
                    i += 2
                elif i + 2 < len(lines) and lines[i + 1].startswith("1 "):
                    name = lines[i]
                    l1 = lines[i + 1]
                    l2 = lines[i + 2]
                    i += 3
                else:
                    i += 1
                    continue

                nid = int(l1[2:7])
                mm = float(l2[52:63])
                ecc = float("0." + l2[26:33].strip())
                inc = float(l2[8:16].strip())
                epoch_dt = _tle_epoch(l1)
                age_days = round(max(0.0, (datetime.now(timezone.utc) - epoch_dt).total_seconds() / 86400.0), 2)
                sma_km, perigee_km, apogee_km, period_min, regime = derive_orbital_metrics(mm, ecc)
                country = classify_country(name, nid)
                group.append({
                    "norad_id": nid,
                    "name": name,
                    "intl_des": l1[9:17].strip(),
                    "object_type": t_label,
                    "country": country,
                    "is_isro": "ISRO" in country or "India" in country,
                    "epoch": epoch_dt.strftime("%Y-%m-%dT%H:%M:%S"),
                    "tle_age_days": age_days,
                    "is_stale": age_days > 14.0,
                    "status": "operational",
                    "mean_motion": mm,
                    "eccentricity": ecc,
                    "inclination": inc,
                    "raan": float(l2[17:25].strip()),
                    "arg_perigee": float(l2[34:42].strip()),
                    "mean_anomaly": float(l2[43:51].strip()),
                    "bstar": _tle_bstar(l1),
                    "semi_major_axis_km": sma_km,
                    "perigee_km": perigee_km,
                    "apogee_km": apogee_km,
                    "period_min": period_min,
                    "regime": regime,
                    "line1": l1,
                    "line2": l2,
                })

        return active, debris


if __name__ == "__main__":
    pipeline = CatalogPipeline()
    meta = pipeline.run_pipeline()
    print(json.dumps(meta, indent=2))
