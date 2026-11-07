"""
OrbitGuard Conjunction Assessment & Astrodynamics Math Engine (Phase 3)
=======================================================================
Implements industry-grade conjunction assessment algorithms:
1. Encounter plane basis construction and relative state projection.
2. Foster-1992 2-D collision probability (Pc) via Gauss-Legendre quadrature.
3. Closed-form small hard-body radius (HBR) asymptotic approximation.
4. Akella & Alfriend (2000) maximum collision probability (Pc_max).
5. Synthetic Radial-Transverse-Normal (RTN) covariance generation with epoch-age growth.
6. RTN to TEME / ECI inertial frame covariance rotation.
7. CCSDS Conjunction Data Message (CDM) parser stub.

References:
- Foster, J. L., "A Method for Calculating Probability of Collision with Space Garbage," 1992.
- Akella, M. R., and Alfriend, K. T., "Probability of Collision Between Space Objects,"
  Journal of Guidance, Control, and Dynamics, Vol. 23, No. 5, 2000, pp. 769-772.
- Vallado, D. A., "Fundamentals of Astrodynamics and Applications," 4th ed., 2013.
"""

from __future__ import annotations

import math
import os
from dataclasses import dataclass
from typing import Dict, Optional, Tuple

import numpy as np
import yaml
from numpy.polynomial.legendre import leggauss

DEFAULT_CONFIG_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "config", "covariance.yaml")


@dataclass
class EncounterState2D:
    """State of conjunction projected onto the 2D encounter plane."""
    miss_vector_km: np.ndarray        # 2-D miss vector m = [x_m, y_m] (km)
    miss_distance_km: float           # ||m|| (km)
    combined_cov_2d: np.ndarray       # 2x2 combined covariance C_2d (km^2)
    relative_speed_kms: float         # ||v_rel|| (km/s)
    mahalanobis_dist: float           # sqrt(m^T * inv(C_2d) * m)
    basis_matrix: np.ndarray          # 2x3 projection matrix B
    hbr_km: float                     # Sum of hard-body radii (km)
    pc_foster: float                  # Foster-1992 2-D Pc
    pc_small_hbr: float               # Asymptotic small-HBR Pc
    pc_max: float                     # Akella-Alfriend max Pc
    k_at_pc_max: float                # Covariance scale factor k achieving Pc_max


def encounter_basis(v_rel: np.ndarray) -> np.ndarray:
    """
    Constructs an orthonormal 2x3 projection matrix whose rows span the
    encounter plane perpendicular to the relative velocity vector v_rel.
    
    Args:
        v_rel: Relative velocity vector in ECI/TEME (km/s), shape (3,)
        
    Returns:
        B: 2x3 matrix with rows [x_hat_e^T; y_hat_e^T]
    """
    norm_v = float(np.linalg.norm(v_rel))
    if norm_v < 1e-9:
        # Near-zero relative speed (co-orbital / co-located satellites)
        # Fall back to standard orthogonal basis
        return np.array([[1.0, 0.0, 0.0], [0.0, 1.0, 0.0]])

    z_hat = v_rel / norm_v

    # Select auxiliary vector not parallel to z_hat
    if abs(z_hat[0]) < 0.9:
        a = np.array([1.0, 0.0, 0.0])
    else:
        a = np.array([0.0, 1.0, 0.0])

    x_hat = np.cross(a, z_hat)
    norm_x = float(np.linalg.norm(x_hat))
    if norm_x < 1e-12:
        a = np.array([0.0, 0.0, 1.0])
        x_hat = np.cross(a, z_hat)
        norm_x = float(np.linalg.norm(x_hat))
    x_hat /= norm_x

    y_hat = np.cross(z_hat, x_hat)
    return np.vstack([x_hat, y_hat])


def encounter_plane_state(
    r_rel: np.ndarray,
    v_rel: np.ndarray,
    c1_eci: np.ndarray,
    c2_eci: np.ndarray,
    hbr_km: float = 0.010,
) -> EncounterState2D:
    """
    Projects the 3-D relative state and inertial covariance matrices onto the 2-D encounter plane.

    Args:
        r_rel: Relative position vector r1 - r2 at TCA in ECI/TEME (km)
        v_rel: Relative velocity vector v1 - v2 at TCA in ECI/TEME (km/s)
        c1_eci: 3x3 positional covariance of object 1 in ECI (km^2)
        c2_eci: 3x3 positional covariance of object 2 in ECI (km^2)
        hbr_km: Combined hard-body radius (km)

    Returns:
        EncounterState2D with 2D miss vector, projected 2x2 covariance, Pc, and Pc_max.
    """
    B = encounter_basis(v_rel)
    c_combined_3d = c1_eci + c2_eci
    C2d = B @ c_combined_3d @ B.T
    m = B @ r_rel
    miss_dist = float(np.linalg.norm(m))
    rel_speed = float(np.linalg.norm(v_rel))

    # Regularize near-singular covariance if needed
    C2d_clean = regularize_covariance_2d(C2d)

    d_mahalanobis_sq = mahalanobis_sq(m, C2d_clean)
    d_mahalanobis = math.sqrt(max(0.0, d_mahalanobis_sq))

    pc_f = pc_foster(m, C2d_clean, hbr_km)
    pc_s = pc_small_hbr(m, C2d_clean, hbr_km)
    pc_m, k_opt = pc_max_with_scale(m, C2d_clean, hbr_km)

    return EncounterState2D(
        miss_vector_km=m,
        miss_distance_km=miss_dist,
        combined_cov_2d=C2d_clean,
        relative_speed_kms=rel_speed,
        mahalanobis_dist=d_mahalanobis,
        basis_matrix=B,
        hbr_km=hbr_km,
        pc_foster=pc_f,
        pc_small_hbr=pc_s,
        pc_max=pc_m,
        k_at_pc_max=k_opt,
    )


def regularize_covariance_2d(c2d: np.ndarray, var_floor: float = 1e-8) -> np.ndarray:
    """
    Ensures a 2x2 covariance matrix is symmetric positive definite with
    eigenvalues bounded below by var_floor.
    """
    c = 0.5 * (c2d + c2d.T)
    eigvals, eigvecs = np.linalg.eigh(c)
    eigvals_clamped = np.maximum(eigvals, var_floor)
    return eigvecs @ np.diag(eigvals_clamped) @ eigvecs.T


def mahalanobis_sq(m: np.ndarray, c2d: np.ndarray) -> float:
    """
    Computes squared Mahalanobis distance d_M^2 = m^T * inv(C2d) * m.
    """
    try:
        sol = np.linalg.solve(c2d, m)
        return float(m @ sol)
    except np.linalg.LinAlgError:
        pinv = np.linalg.pinv(c2d)
        return float(m @ pinv @ m)


def pc_foster(
    m: np.ndarray,
    c2d: np.ndarray,
    hbr_km: float,
    n_r: int = 64,
    n_t: int = 128,
) -> float:
    """
    Foster-1992 2-D Collision Probability (Pc).
    Integrates the bivariate Gaussian error density over a circular disk
    of radius hbr_km on the encounter plane.

    Args:
        m: 2-D miss vector at TCA [x_m, y_m] (km)
        c2d: 2x2 combined covariance matrix (km^2)
        hbr_km: Hard-body radius (km)
        n_r: Number of radial Gauss-Legendre quadrature points
        n_t: Number of angular points

    Returns:
        Pc: Probability of collision (float between 0.0 and 1.0)
    """
    if hbr_km <= 0.0:
        return 0.0

    c2d = regularize_covariance_2d(c2d)
    det = float(np.linalg.det(c2d))
    if det <= 0.0:
        return 0.0

    Ci = np.linalg.inv(c2d)

    # Gauss-Legendre quadrature nodes & weights mapped from [-1, 1] to [0, hbr_km]
    xr, wr = leggauss(n_r)
    r = 0.5 * hbr_km * (xr + 1.0)
    wr = 0.5 * hbr_km * wr

    th = np.linspace(0.0, 2.0 * np.pi, n_t, endpoint=False)
    wt = 2.0 * np.pi / n_t

    # Meshgrid of polar integration coordinates
    R, T = np.meshgrid(r, th, indexing="ij")
    # Coordinates relative to miss vector
    P = np.stack([R * np.cos(T), R * np.sin(T)], -1) - m

    # Vectorized quadratic form: (P - m)^T * inv(C2d) * (P - m)
    q = np.einsum("...i,ij,...j->...", P, Ci, P)

    # Radial & angular weighted sum
    val = float((np.exp(-0.5 * q) * R * wr[:, None]).sum() * wt)
    pc = val / (2.0 * np.pi * math.sqrt(det))

    # Clamp to valid physical probability interval [0, 1]
    return float(np.clip(pc, 0.0, 1.0))


def pc_small_hbr(m: np.ndarray, c2d: np.ndarray, hbr_km: float) -> float:
    """
    Closed-form asymptotic approximation for Pc when HBR << sigma:
    Pc ~ (HBR^2 / (2 * sqrt(det(C2d)))) * exp(-0.5 * d_M^2)
    """
    if hbr_km <= 0.0:
        return 0.0

    c2d = regularize_covariance_2d(c2d)
    det = float(np.linalg.det(c2d))
    if det <= 0.0:
        return 0.0

    d_sq = mahalanobis_sq(m, c2d)
    val = (hbr_km**2 / (2.0 * math.sqrt(det))) * math.exp(-0.5 * d_sq)
    return float(np.clip(val, 0.0, 1.0))


def pc_max_with_scale(
    m: np.ndarray,
    c2d: np.ndarray,
    hbr_km: float,
    ks: Optional[np.ndarray] = None,
) -> Tuple[float, float]:
    """
    Akella & Alfriend (2000) Maximum Probability of Collision (Pc_max).
    Scans covariance scale factor k over a log-spaced grid to find the
    upper bound on Pc given the encounter geometry.

    Returns:
        (pc_max, k_at_max): Tuple of maximum Pc and scale factor k.
    """
    if ks is None:
        ks = np.logspace(-2.0, 2.0, 160)

    max_pc = 0.0
    best_k = 1.0

    for k in ks:
        scaled_c2d = k * c2d
        val = pc_foster(m, scaled_c2d, hbr_km, n_r=32, n_t=64)
        if val > max_pc:
            max_pc = val
            best_k = float(k)

    return float(max_pc), float(best_k)


def pc_max(m: np.ndarray, c2d: np.ndarray, hbr_km: float) -> float:
    """Convenience wrapper returning only Pc_max."""
    p_max, _ = pc_max_with_scale(m, c2d, hbr_km)
    return p_max


class CovarianceProvider:
    """Abstract base class for orbit state uncertainty providers."""

    def get_covariance_eci(
        self,
        norad_id: int,
        r_eci: np.ndarray,
        v_eci: np.ndarray,
        epoch_age_days: float = 0.0,
    ) -> np.ndarray:
        raise NotImplementedError


class SyntheticRTNCovariance(CovarianceProvider):
    """
    Generates screening-grade synthetic covariance in the satellite's
    Radial-Transverse-Normal (RTN) reference frame and rotates it into
    the TEME / ECI celestial inertial frame.

    RTN frame definition:
    - R (Radial): Unit vector along position r_hat = r / ||r|| (outward from Earth centre)
    - N (Normal): Unit vector along orbital angular momentum n_hat = (r x v) / ||r x v||
    - T (Transverse/In-Track): Completes right-handed system t_hat = n_hat x r_hat
    """

    def __init__(self, config_path: Optional[str] = None):
        # Load tunable coefficients from config/covariance.yaml if present
        self.sigma_r0 = 0.100       # 100 m
        self.sigma_t0 = 0.800       # 800 m
        self.sigma_n0 = 0.150       # 150 m
        self.rate_r = 0.050         # km / day
        self.rate_t = 0.750         # km / day
        self.rate_n = 0.060         # km / day
        self.t_exponent = 1.25

        if config_path is None:
            config_path = DEFAULT_CONFIG_PATH  # previously config/covariance.yaml was never actually loaded
        if config_path and os.path.exists(config_path):
            try:
                with open(config_path, "r", encoding="utf-8") as f:
                    cfg = yaml.safe_load(f)
                    rtn = cfg.get("synthetic_rtn", {})
                    init_sig = rtn.get("initial_sigma_km", {})
                    growth = rtn.get("growth_rate_per_day", {})
                    self.sigma_r0 = float(init_sig.get("radial", self.sigma_r0))
                    self.sigma_t0 = float(init_sig.get("transverse", self.sigma_t0))
                    self.sigma_n0 = float(init_sig.get("normal", self.sigma_n0))
                    self.rate_r = float(growth.get("radial", self.rate_r))
                    self.rate_t = float(growth.get("transverse", self.rate_t))
                    self.rate_n = float(growth.get("normal", self.rate_n))
                    self.t_exponent = float(rtn.get("along_track_age_exponent", self.t_exponent))
            except Exception as e:
                print(f"[Warning] Could not load {config_path}: {e}")

    def get_rtn_sigmas(self, epoch_age_days: float) -> Tuple[float, float, float]:
        """Calculates 1-sigma uncertainties in RTN given TLE element set age."""
        age = max(0.0, float(epoch_age_days))
        sigma_r = self.sigma_r0 + self.rate_r * age
        sigma_t = self.sigma_t0 + self.rate_t * (age ** self.t_exponent)
        sigma_n = self.sigma_n0 + self.rate_n * age
        return sigma_r, sigma_t, sigma_n

    def get_covariance_eci(
        self,
        norad_id: int,
        r_eci: np.ndarray,
        v_eci: np.ndarray,
        epoch_age_days: float = 0.0,
    ) -> np.ndarray:
        """
        Computes the 3x3 ECI positional covariance matrix by rotating
        the age-dependent RTN diagonal covariance.
        """
        r_norm = float(np.linalg.norm(r_eci))
        if r_norm < 1e-6:
            return np.diag([1.0, 1.0, 1.0])

        r_hat = r_eci / r_norm

        rv_cross = np.cross(r_eci, v_eci)
        h_norm = float(np.linalg.norm(rv_cross))
        if h_norm < 1e-12:
            # Fallback if position and velocity are parallel
            return np.diag([1.0, 1.0, 1.0])

        n_hat = rv_cross / h_norm
        t_hat = np.cross(n_hat, r_hat)

        # Transformation matrix R whose columns are r_hat, t_hat, n_hat
        # R_rtn_to_eci = [r_hat, t_hat, n_hat]
        R = np.column_stack([r_hat, t_hat, n_hat])

        sig_r, sig_t, sig_n = self.get_rtn_sigmas(epoch_age_days)
        c_rtn = np.diag([sig_r ** 2, sig_t ** 2, sig_n ** 2])

        c_eci = R @ c_rtn @ R.T
        return c_eci


class CDMCovarianceProvider(CovarianceProvider):
    """
    Parses real CCSDS Conjunction Data Messages (CDMs) to extract
    official sensor-calibrated 3x3 or 6x6 covariance matrices.
    """

    def __init__(self, cdm_records: Optional[Dict[int, np.ndarray]] = None):
        self.cdm_records = cdm_records or {}

    def register_cdm(self, norad_id: int, cov_eci_3x3: np.ndarray):
        self.cdm_records[norad_id] = cov_eci_3x3

    def get_covariance_eci(
        self,
        norad_id: int,
        r_eci: np.ndarray,
        v_eci: np.ndarray,
        epoch_age_days: float = 0.0,
    ) -> np.ndarray:
        if norad_id in self.cdm_records:
            return self.cdm_records[norad_id]
        # Fall back to synthetic RTN if no CDM record is registered
        fallback = SyntheticRTNCovariance()
        return fallback.get_covariance_eci(norad_id, r_eci, v_eci, epoch_age_days)
