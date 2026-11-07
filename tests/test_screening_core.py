"""Synthetic-orbit tests for the conjunction candidate screener (numpy/scipy only)."""

import math

import numpy as np

from scripts.pipeline.screening_core import ball_radius_km, screen_candidates

MU = 398600.4418


def _circular(radius, inc_axis, phase, times):
    w = math.sqrt(MU / radius**3)
    ang = w * times + phase
    c, s = np.cos(ang), np.sin(ang)
    z = np.zeros_like(times)
    if inc_axis == "equatorial":
        pos = np.stack([c, s, z], -1) * radius
        vel = np.stack([-s, c, z], -1) * radius * w
    else:  # polar orbit in the x-z plane
        pos = np.stack([c, z, s], -1) * radius
        vel = np.stack([-s, z, c], -1) * radius * w
    return pos, vel


def test_finds_off_grid_encounter_that_a_fixed_40km_ball_would_miss():
    step = 30.0
    times = np.arange(0, 2400, step)
    t0 = 1000.0  # encounter time, deliberately between grid points
    r = 7000.0
    w = math.sqrt(MU / r**3)

    tp, tv = _circular(r, "equatorial", -w * t0, times)
    hp, hv = _circular(r, "polar", -w * t0 + 0.0005, times)  # ~3.5 km along-track offset
    dp, dv = _circular(7500.0, "equatorial", 0.3, times)  # decoy, never within 25 km

    tgt_r, tgt_v = tp[None], tv[None]
    thr_r = np.stack([hp, dp])
    thr_v = np.stack([hv, dv])

    # sanity: nearest *sample* distance is far above 40 km (the old screening radius)
    sample_min = np.linalg.norm(tp - hp, axis=1).min()
    assert sample_min > 40.0

    found = screen_candidates(tgt_r, tgt_v, thr_r, thr_v, step, lin_threshold_km=25.0)
    assert (0, 0) in found
    assert (0, 1) not in found
    miss, tca = found[(0, 0)]
    assert miss < 5.0
    assert abs(tca - t0) < 3.0


def test_ball_radius_covers_half_step_travel():
    assert ball_radius_km(60.0, 25.0) > 16.0 * 0.75 * 60.0
