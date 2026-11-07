"""
Pure-numpy conjunction candidate screening (no sgp4 dependency, unit-testable).

Why this exists
---------------
Objects in LEO close at up to ~15 km/s. On a 30-60 s time grid a fixed 40 km ball query
therefore misses almost every real encounter (the objects move 450-900 km between samples).
Instead we:
  1. query a ball whose radius covers the distance travelled in half a step, and
  2. for each neighbour, solve the linear time-of-closest-approach from the relative state
     (t* = -r.v / |v|^2) and keep the pair if the linearised miss distance is small.
Survivors are refined with true SGP4 propagation by the caller.
"""

from __future__ import annotations

from typing import Dict, Tuple

import numpy as np
from scipy.spatial import cKDTree

V_REL_MAX_KMS = 16.0  # upper bound on LEO relative speed (head-on ~15.5 km/s)


def ball_radius_km(step_sec: float, lin_threshold_km: float, window_frac: float = 0.75) -> float:
    """Radius that guarantees any pair with |t*| <= window_frac*step and miss <= threshold is found."""
    travel = V_REL_MAX_KMS * window_frac * step_sec
    return float(np.hypot(lin_threshold_km, travel))


def screen_candidates(
    tgt_r: np.ndarray,
    tgt_v: np.ndarray,
    thr_r: np.ndarray,
    thr_v: np.ndarray,
    step_sec: float,
    lin_threshold_km: float,
    t0_offset_sec: float = 0.0,
    window_frac: float = 0.75,
) -> Dict[Tuple[int, int], Tuple[float, float]]:
    """
    Args:
        tgt_r, tgt_v: (n_targets, n_steps, 3) positions (km) / velocities (km/s); NaN = invalid.
        thr_r, thr_v: (n_threats, n_steps, 3) likewise.
        step_sec: grid spacing.
        lin_threshold_km: keep pairs whose linearised miss distance is below this.
        t0_offset_sec: time of step 0 relative to the screening start (for chunked runs).
    Returns:
        {(target_idx, threat_idx): (linear_miss_km, tca_seconds_since_screening_start)}
    """
    n_steps = tgt_r.shape[1]
    radius = ball_radius_km(step_sec, lin_threshold_km, window_frac)
    best: Dict[Tuple[int, int], Tuple[float, float]] = {}

    for k in range(n_steps):
        thr_pos = thr_r[:, k, :]
        thr_ok = np.nonzero(np.isfinite(thr_pos).all(axis=1))[0]
        if thr_ok.size == 0:
            continue
        tgt_pos = tgt_r[:, k, :]
        tgt_ok = np.nonzero(np.isfinite(tgt_pos).all(axis=1))[0]
        if tgt_ok.size == 0:
            continue

        tree = cKDTree(thr_pos[thr_ok])
        neighbours = tree.query_ball_point(tgt_pos[tgt_ok], r=radius)

        for ti, nb in zip(tgt_ok, neighbours):
            if not nb:
                continue
            thi = thr_ok[np.asarray(nb)]
            rel_r = tgt_pos[ti] - thr_r[thi, k, :]
            rel_v = tgt_v[ti, k, :] - thr_v[thi, k, :]
            vv = np.maximum((rel_v * rel_v).sum(axis=1), 1e-12)
            t_lin = -(rel_r * rel_v).sum(axis=1) / vv
            miss = np.linalg.norm(rel_r + rel_v * t_lin[:, None], axis=1)
            keep = (np.abs(t_lin) <= window_frac * step_sec) & (miss <= lin_threshold_km)
            for j in np.nonzero(keep)[0]:
                key = (int(ti), int(thi[j]))
                cand = (float(miss[j]), t0_offset_sec + k * step_sec + float(t_lin[j]))
                if key not in best or cand[0] < best[key][0]:
                    best[key] = cand
    return best
