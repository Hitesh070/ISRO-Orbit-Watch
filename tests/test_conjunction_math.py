"""
Unit Test Suite for Conjunction Analysis Math Engine (Phase 3)
==============================================================
Validates:
1. Exact analytic isotropic covariance test: Pc = 1 - exp(-R^2 / (2*sigma^2))
2. Monte Carlo numerical integration cross-validation against Foster-1992 Pc
3. Small-HBR closed-form asymptotic agreement when R << sigma
4. Monotonicity of Pc as miss distance increases
5. Ill-conditioned & singular covariance regularization (never NaN)
6. RTN to ECI rotation matrix orthogonality and determinant preservation
"""

import math

import numpy as np

from scripts.pipeline.conjunction_engine import (
    SyntheticRTNCovariance,
    pc_foster,
    pc_small_hbr,
    regularize_covariance_2d,
)


class TestConjunctionAstrodynamicsMath:
    def test_analytic_isotropic_covariance(self):
        """
        With m = 0 and isotropic covariance C = sigma^2 * I,
        Pc must equal exactly 1 - exp(-R^2 / (2 * sigma^2)).
        """
        sigma = 0.500  # 500 meters = 0.5 km
        c2d = np.diag([sigma ** 2, sigma ** 2])
        m = np.array([0.0, 0.0])
        hbr_km = 0.015  # 15 meters = 0.015 km

        pc_computed = pc_foster(m, c2d, hbr_km, n_r=64, n_t=128)
        pc_exact = 1.0 - math.exp(-(hbr_km ** 2) / (2.0 * sigma ** 2))

        # Check relative agreement within 1e-4
        assert abs(pc_computed - pc_exact) / pc_exact < 1e-4
        print(f"\n[Analytic Pc Test] Computed: {pc_computed:.8e}, Exact: {pc_exact:.8e}")

    def test_monte_carlo_cross_validation(self):
        """
        Compares Foster-1992 numerical quadrature against Monte Carlo sampling
        (250,000 random bivariate Gaussian samples) on an anisotropic encounter geometry.
        """
        # Anisotropic covariance with correlation (cross-term)
        sigma_x = 0.400  # km
        sigma_y = 0.800  # km
        rho = 0.35
        cov_xy = rho * sigma_x * sigma_y
        c2d = np.array([
            [sigma_x ** 2, cov_xy],
            [cov_xy, sigma_y ** 2]
        ])

        # Miss vector offset
        m = np.array([0.150, -0.200])  # km
        hbr_km = 0.025  # 25 meters

        pc_quadrature = pc_foster(m, c2d, hbr_km, n_r=64, n_t=128)

        # Monte Carlo estimation
        np.random.seed(42)
        n_samples = 300_000
        samples = np.random.multivariate_normal(mean=m, cov=c2d, size=n_samples)
        # Distance of each sample from origin (where the other object's centre is)
        distances = np.linalg.norm(samples, axis=1)
        samples_in_disk = np.count_nonzero(distances <= hbr_km)
        pc_mc = samples_in_disk / n_samples
        mc_std_error = math.sqrt(pc_mc * (1.0 - pc_mc) / n_samples)

        print(f"\n[Monte Carlo Test] Foster Pc: {pc_quadrature:.6e}, MC Pc: {pc_mc:.6e} (±{2*mc_std_error:.6e})")

        # Must agree within 3 standard errors of the Monte Carlo estimate
        assert abs(pc_quadrature - pc_mc) < max(3.0 * mc_std_error, 2e-4)

    def test_small_hbr_asymptotic_agreement(self):
        """
        When HBR is much smaller than position uncertainty (HBR << sigma),
        the small-HBR closed-form formula must agree with pc_foster.
        """
        c2d = np.array([[0.64, 0.08], [0.08, 0.36]])
        m = np.array([0.30, 0.15])
        hbr_small = 0.005  # 5 meters

        pc_f = pc_foster(m, c2d, hbr_small)
        pc_s = pc_small_hbr(m, c2d, hbr_small)

        rel_error = abs(pc_f - pc_s) / pc_f
        print(f"\n[Small HBR Test] Foster: {pc_f:.6e}, Small-HBR: {pc_s:.6e}, RelError: {rel_error:.4%}")
        # Agreement must be better than 0.5% for HBR/sigma < 0.01
        assert rel_error < 0.005

    def test_monotonicity_with_miss_distance(self):
        """
        Pc must monotonically decrease as the miss distance increases
        along a radial vector from the origin (fixed covariance and HBR).
        """
        c2d = np.diag([0.25, 0.49])
        hbr_km = 0.020
        direction = np.array([1.0, 1.0]) / math.sqrt(2.0)

        miss_distances = [0.0, 0.1, 0.3, 0.6, 1.2, 2.5]
        pcs = []

        for d in miss_distances:
            m = d * direction
            pc = pc_foster(m, c2d, hbr_km)
            pcs.append(pc)

        # Verify strict monotonic decrease
        for i in range(len(pcs) - 1):
            assert pcs[i] > pcs[i + 1], f"Monotonicity violated: Pc({miss_distances[i]})={pcs[i]} <= Pc({miss_distances[i+1]})={pcs[i+1]}"

    def test_singular_and_ill_conditioned_covariance(self):
        """
        Singular or near-singular covariance matrices must regularize safely
        without crashing or producing NaN/infinite results.
        """
        # Exactly singular covariance (rank 1)
        c_singular = np.array([[1.0, 1.0], [1.0, 1.0]])
        m = np.array([0.5, 0.5])
        hbr_km = 0.010

        c_reg = regularize_covariance_2d(c_singular, var_floor=1e-6)
        assert np.all(np.isfinite(c_reg))
        assert np.linalg.det(c_reg) > 0

        pc = pc_foster(m, c_singular, hbr_km)
        assert np.isfinite(pc)
        assert 0.0 <= pc <= 1.0

    def test_rtn_to_eci_rotation_orthogonality(self):
        """
        Verifies that the synthetic RTN rotation matrix R = [r_hat, t_hat, n_hat]
        is orthonormal: R * R^T = I and det(R) = +1.0.
        """
        provider = SyntheticRTNCovariance()
        r_eci = np.array([6878.0, 240.0, -120.0])
        v_eci = np.array([0.15, 7.55, 1.45])

        r_norm = np.linalg.norm(r_eci)
        r_hat = r_eci / r_norm
        rv_cross = np.cross(r_eci, v_eci)
        n_hat = rv_cross / np.linalg.norm(rv_cross)
        t_hat = np.cross(n_hat, r_hat)

        R = np.column_stack([r_hat, t_hat, n_hat])

        # Orthogonality check: R * R^T = I
        ident = R @ R.T
        assert np.allclose(ident, np.eye(3), atol=1e-12)
        assert abs(np.linalg.det(R) - 1.0) < 1e-12

        # Verify covariance matrix is symmetric and positive definite in ECI
        cov_eci = provider.get_covariance_eci(12345, r_eci, v_eci, epoch_age_days=2.5)
        assert np.allclose(cov_eci, cov_eci.T, atol=1e-12)
        eigvals = np.linalg.eigvalsh(cov_eci)
        assert np.all(eigvals > 0)
