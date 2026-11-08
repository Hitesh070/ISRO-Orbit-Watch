"""Check whether the SOCRATES endpoint is reachable and write an honest status report.

This script does not yet parse and match SOCRATES events against OrbitGuard records.
It therefore never reports event-level cross-validation or collision probabilities.
"""

import datetime
import json
from pathlib import Path
from typing import Optional

import httpx

SOCRATES_URL = "https://celestrak.org/SOCRATES/socrates.csv"


def fetch_socrates_data(timeout_sec: float = 8.0) -> Optional[str]:
    """Return the source CSV when reachable; do not create an offline benchmark."""
    headers = {"User-Agent": "OrbitGuard-SSA/3.0 (Educational Astrodynamics Tool)"}
    try:
        with httpx.Client(timeout=timeout_sec, follow_redirects=True) as client:
            response = client.get(SOCRATES_URL, headers=headers)
            response.raise_for_status()
            return response.text or None
    except Exception as exc:
        print(f"[Notice] SOCRATES unavailable; no synthetic benchmark will be substituted: {exc}")
        return None


def run_cross_validation(conjunctions_path: str, validation_doc_path: str) -> None:
    """Write a status report and clearly state that event-level comparison is not implemented."""
    source_available = fetch_socrates_data() is not None
    snapshot = Path(conjunctions_path)
    screening_status = "unavailable"
    screen_time = "Unavailable"
    event_count = "Unavailable"

    if snapshot.is_file():
        try:
            data = json.loads(snapshot.read_text(encoding="utf-8"))
            screening_status = str(data.get("screening_status", "not independently verified"))
            screen_time = str(data.get("screen_time_utc") or "Unavailable")
            events = data.get("conjunctions")
            if isinstance(events, list):
                event_count = str(len(events))
        except (OSError, json.JSONDecodeError) as exc:
            screening_status = f"unreadable snapshot: {exc}"

    checked_at = datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")
    doc = f"""# OrbitGuard / SOCRATES Validation Status

Checked: {checked_at}

## Result

**No event-level cross-validation has been performed.** This utility checks whether the
SOCRATES CSV endpoint is reachable, but it does not parse its records or match events.
Endpoint reachable: **{source_available}**.

The local conjunction snapshot status is **{screening_status}**, with screen time
**{screen_time}** and {event_count} records. These values are descriptive only and are
not evidence of agreement with SOCRATES. Collision probabilities require measured
covariance from an authoritative Conjunction Data Message (CDM); this report does not
calculate or infer them.

No synthetic benchmark, sample event, or substitute probability is generated when a
source is missing.
"""
    output = Path(validation_doc_path)
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(doc, encoding="utf-8")
    print(f"Wrote validation status (no event-level comparison) to {output}")


if __name__ == "__main__":
    run_cross_validation("backend/data/conjunctions.json", "docs/VALIDATION.md")
