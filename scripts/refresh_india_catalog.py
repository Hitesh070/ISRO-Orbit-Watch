#!/usr/bin/env python3
"""Refresh a verified public Indian spacecraft catalog from CelesTrak.

GP orbital elements are requested no more than once per two hours. SATCAT owner
metadata is refreshed at most every 12 hours. Existing validated data survives
network or validation failures; no demo/synthetic orbital records are created.
"""
from __future__ import annotations

import json
import math
import os
import tempfile
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

import httpx
from sgp4.api import Satrec, jday
from sgp4.omm import initialize

ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / "frontend" / "public" / "data"
CATALOG_PATH = DATA_DIR / "catalog.json"
META_PATH = DATA_DIR / "meta.json"
SATCAT_PATH = DATA_DIR / "satcat-india.json"
GP_URL = "https://celestrak.org/NORAD/elements/gp.php?GROUP=active&FORMAT=json"
SATCAT_URL = "https://celestrak.org/satcat/records.php?GROUP=ACTIVE&FORMAT=JSON&ACTIVE=1&ONORBIT=1&PAYLOADS=1"
GP_INTERVAL = timedelta(hours=2)
SATCAT_INTERVAL = timedelta(hours=12)
OWNER_CODES = {"IND", "ISRO"}


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def parse_time(value: Any) -> datetime | None:
    if not isinstance(value, str):
        return None
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
        return parsed.replace(tzinfo=timezone.utc) if parsed.tzinfo is None else parsed.astimezone(timezone.utc)
    except ValueError:
        return None


def read_json(path: Path, fallback: Any) -> Any:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return fallback


def atomic_json(path: Path, value: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, temporary = tempfile.mkstemp(prefix=path.name, suffix=".tmp", dir=path.parent)
    try:
        with os.fdopen(fd, "w", encoding="utf-8", newline="\n") as stream:
            json.dump(value, stream, ensure_ascii=False, separators=(",", ":"))
            stream.write("\n")
        os.replace(temporary, path)
    finally:
        if os.path.exists(temporary):
            os.unlink(temporary)


def fetch_json(client: httpx.Client, url: str) -> Any:
    response = client.get(url)
    response.raise_for_status()
    return response.json()


def is_valid_gp(record: dict[str, Any], now: datetime) -> bool:
    try:
        norad = int(record["NORAD_CAT_ID"])
        epoch = parse_time(record["EPOCH"])
        motion = float(record["MEAN_MOTION"])
        eccentricity = float(record["ECCENTRICITY"])
        inclination = float(record["INCLINATION"])
        if norad <= 0 or not record.get("OBJECT_NAME") or epoch is None:
            return False
        if epoch > now + timedelta(minutes=10) or epoch < now - timedelta(days=365):
            return False
        if not (0 < motion < 20 and 0 <= eccentricity < 1 and 0 <= inclination <= 180):
            return False
        satrec = Satrec()
        initialize(satrec, record)
        jd, fr = jday(now.year, now.month, now.day, now.hour, now.minute, now.second + now.microsecond / 1e6)
        error, position, velocity = satrec.sgp4(jd, fr)
        return error == 0 and all(math.isfinite(component) for component in (*position, *velocity))
    except (KeyError, TypeError, ValueError, OverflowError):
        return False


def fetch_satcat(client: httpx.Client, now: datetime) -> tuple[dict[int, dict[str, Any]], str]:
    records = fetch_json(client, SATCAT_URL)
    if not isinstance(records, list):
        raise ValueError("SATCAT response was not a record list")
    matched: dict[int, dict[str, Any]] = {}
    for record in records:
        try:
            norad = int(record.get("NORAD_CAT_ID", record.get("NORAD_CATID")))
        except (ValueError, TypeError):
            continue
        owner = str(record.get("OWNER", record.get("OWNER_CODE", ""))).strip().upper()
        object_type = str(record.get("OBJECT_TYPE", "")).strip().upper()
        if owner in OWNER_CODES and object_type in {"PAY", "PAYLOAD"}:
            matched[norad] = {
                "NORAD_CAT_ID": norad,
                "OBJECT_NAME": record.get("OBJECT_NAME"),
                "OWNER": owner,
                "OBJECT_TYPE": "PAY",
                "OBJECT_ID": record.get("OBJECT_ID"),
                "LAUNCH_DATE": record.get("LAUNCH_DATE"),
                "LAUNCH_SITE": record.get("LAUNCH_SITE"),
                "OPS_STATUS_CODE": record.get("OPS_STATUS_CODE"),
            }
    if not matched:
        raise ValueError("SATCAT contained no records matching the documented India owner codes")
    return matched, now.isoformat(timespec="seconds").replace("+00:00", "Z")


def main() -> int:
    now = utcnow()
    old_meta = read_json(META_PATH, {})
    old_catalog = read_json(CATALOG_PATH, [])
    old_satcat = read_json(SATCAT_PATH, {})
    if not isinstance(old_catalog, list):
        old_catalog = []
    with httpx.Client(timeout=45, headers={"User-Agent": "ISRO-Orbit-Watch/1.0 (public data client)"}) as client:
        satcat = old_satcat.get("records", {}) if isinstance(old_satcat, dict) else {}
        satcat_time = parse_time(old_satcat.get("fetch_time_utc")) if isinstance(old_satcat, dict) else None
        if not satcat_time or now - satcat_time >= SATCAT_INTERVAL:
            satcat_records, satcat_time_text = fetch_satcat(client, now)
            satcat = {str(key): value for key, value in satcat_records.items()}
            atomic_json(SATCAT_PATH, {"fetch_time_utc": satcat_time_text, "records": satcat})
            satcat_time = parse_time(satcat_time_text)
        else:
            satcat_time_text = satcat_time.isoformat(timespec="seconds").replace("+00:00", "Z")

        last_gp_time = parse_time(old_meta.get("fetch_time_utc")) if isinstance(old_meta, dict) else None
        if last_gp_time and now - last_gp_time < GP_INTERVAL:
            print(f"GP refresh skipped: last successful fetch was {old_meta['fetch_time_utc']}")
            return 0
        gp_records = fetch_json(client, GP_URL)
        if not isinstance(gp_records, list):
            raise ValueError("GP/OMM response was not a record list")
        selected: dict[int, dict[str, Any]] = {}
        for record in gp_records:
            try:
                norad = int(record["NORAD_CAT_ID"])
            except (KeyError, ValueError, TypeError):
                continue
            owner_record = satcat.get(str(norad))
            if not owner_record or owner_record.get("OBJECT_TYPE") != "PAY":
                continue
            if not is_valid_gp(record, now):
                continue
            merged = {**record, **owner_record, "NORAD_CAT_ID": norad}
            selected[norad] = merged
        if not selected:
            raise ValueError("No GP records passed ownership and SGP4 propagation validation; previous catalog preserved")

    epochs = [parse_time(record["EPOCH"]) for record in selected.values()]
    epoch_values = [epoch for epoch in epochs if epoch is not None]
    manifest = {
        "source": "CelesTrak SATCAT (India ownership) + GP/OMM orbital elements",
        "fetch_time_utc": now.isoformat(timespec="seconds").replace("+00:00", "Z"),
        "satcat_time_utc": satcat_time_text,
        "total_objects": len(selected),
        "stale_after_hours": 6,
        "min_element_epoch_utc": min(epoch_values).isoformat(timespec="seconds").replace("+00:00", "Z"),
        "max_element_epoch_utc": max(epoch_values).isoformat(timespec="seconds").replace("+00:00", "Z"),
        "update_interval_hours": 2,
        "position_note": "SGP4 predictions from catalog elements; not live spacecraft telemetry.",
    }
    atomic_json(CATALOG_PATH, sorted(selected.values(), key=lambda row: row["OBJECT_NAME"]))
    atomic_json(META_PATH, manifest)
    print(f"Published {len(selected)} India-owner payloads; GP fetched {manifest['fetch_time_utc']}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
