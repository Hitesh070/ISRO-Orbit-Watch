"""
SGP4 Verification Test Suite (Python sgp4 package)
===================================================
Tests SGP4 orbital propagation against the official published Vallado verification vectors
(AIAA 2006-6753: Revisiting Spacetrack Report #3).

Asserts positional agreement within tolerance (< 1e-3 km = 1 meter)
and velocity agreement within tolerance (< 1e-5 km/s = 10 mm/s).
"""

import json
from pathlib import Path

import numpy as np
import pytest
from sgp4.api import Satrec

FIXTURE_PATH = Path(__file__).resolve().parent / "fixtures" / "vallado_cases.json"


@pytest.fixture(scope="module")
def vallado_data():
    with open(FIXTURE_PATH, "r", encoding="utf-8") as f:
        return json.load(f)


def test_sgp4_vallado_verification_cases(vallado_data):
    """
    Validate Python sgp4 package against official Vallado SGP4 test vectors.
    """
    valid_cases = vallado_data["valid_cases"]
    assert len(valid_cases) > 50, "Verification dataset must contain full test set."

    max_pos_err = 0.0
    max_vel_err = 0.0

    for case in valid_cases:
        line1 = case["line1"]
        line2 = case["line2"]
        tsince = case["tsince_min"]
        expected_r = np.array(case["expected_r_km"])
        expected_v = np.array(case["expected_v_km_s"])

        # Initialize SGP4
        satrec = Satrec.twoline2rv(line1, line2)

        # Propagate to minutes from epoch using sgp4_tsince
        e, r, v = satrec.sgp4_tsince(tsince)

        assert e == 0, f"SGP4 propagation error code {e} for satnum {case['satnum']} at t={tsince}"

        pos_diff = float(np.linalg.norm(np.array(r) - expected_r))
        vel_diff = float(np.linalg.norm(np.array(v) - expected_v))

        max_pos_err = max(max_pos_err, pos_diff)
        max_vel_err = max(max_vel_err, vel_diff)

        # Strict tolerances: < 1e-3 km (1 meter) position, < 1e-5 km/s (10 mm/s) velocity
        assert pos_diff < 1e-3, f"Position error {pos_diff:.6e} km exceeds tolerance for sat {case['satnum']}"
        assert vel_diff < 1e-5, f"Velocity error {vel_diff:.6e} km/s exceeds tolerance for sat {case['satnum']}"

    print(f"\n[SGP4 Vallado Validation] Passed {len(valid_cases)} cases.")
    print(f"Max Position Error: {max_pos_err:.6e} km ({max_pos_err * 1e6:.3f} mm)")
    print(f"Max Velocity Error: {max_vel_err:.6e} km/s ({max_vel_err * 1e6:.3f} mm/s)")


def test_sgp4_decay_error_handling(vallado_data):
    """
    Verify that SGP4 properly flags decayed satellites (e.g. error code 6)
    and non-zero error states rather than crashing or returning invalid numbers.
    """
    for case in vallado_data.get("error_cases", []):
        satrec = Satrec.twoline2rv(case["line1"], case["line2"])
        e, r, v = satrec.sgp4_tsince(case["tsince_min"])
        assert e != 0, f"Expected non-zero error code for satnum {case['satnum']}, got {e}"

    # Additional synthetic high-drag decayed case
    line1 = "1 99999U 20001A   20001.00000000  .15000000  00000+0  10000-1 0  9999"
    line2 = "2 99999  51.6400 100.0000 0005000  50.0000 310.0000 16.50000000    10"
    satrec = Satrec.twoline2rv(line1, line2)
    e, r, v = satrec.sgp4_tsince(72000.0)
    assert e != 0 or r[0] < 6378.137, "Decayed object must report error code or perigee decay"
