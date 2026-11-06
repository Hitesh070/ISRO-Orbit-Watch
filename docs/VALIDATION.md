# OrbitGuard Conjunction Cross-Validation Report (Phase 3)

**Validation Date:** 2026-11-06 16:28:24 UTC  
**Benchmark Source:** CelesTrak SOCRATES (Satellite Orbital Conjunction Reports Assessing Threat Encouraging Siting)  
**Astrodynamics Propagator:** SGP4 (AIAA 2006-6753)  
**Probability Method:** Foster-1992 2-D Integral & Akella-Alfriend (2000) $P_{c,\text{max}}$  

---

## 1. Methodology & Theoretical Differences

When comparing OrbitGuard's predicted conjunction events against SOCRATES or operational Space Command CDMs, discrepancies in **Time of Closest Approach (TCA)** and **Miss Distance** are expected and mathematically natural.

| Factor | OrbitGuard Conjunction Engine | CelesTrak SOCRATES |
| :--- | :--- | :--- |
| **Ephemeris Source** | General Perturbations (OMM/GP TLEs) | CelesTrak Master TLE Catalog |
| **Screening Window** | Rolling 24-Hour Horizon | 7-Day Horizon |
| **Interpolation / Refinement** | Continuous 1-D Bounded Minimization (`scipy.optimize.minimize_scalar`) | Fixed-step SGP4 search with polynomial interpolation |
| **Covariance Model** | **Synthetic RTN** calibrated for TLE epoch age ($R=100\text{m}, T=800\text{m}, N=150\text{m}$) | Geometric miss distance screening without covariance |
| **Probability Metric** | **Foster-1992 2-D $P_c$** ($n_r=64, n_\theta=128$) & **Akella $P_{c,\text{max}}$** | Maximum probability bound under isotropic spherical error |

---

## 2. Cross-Matched Event Verification Sample

Comparison of sample close approaches evaluated across the current operational catalog:

| Target Spacecraft | Threat Object | TCA (UTC) | OrbitGuard Miss (km) | Foster $P_c$ | Akella $P_{c,\text{max}}$ | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **SL-8 R/B** (5730) | FENGYUN 1C DEB (35169) | `2026-11-07T05:38:18Z` | **1.016 km** | 8.18e-05 | 8.64e-05 | `WARNING` |
| **RESOURCESAT-2A** (41877) | FENGYUN 1C DEB (31515) | `2026-11-07T10:07:11Z` | **3.894 km** | 3.55e-07 | 7.46e-07 | `WARNING` |
| **RESOURCESAT-2A** (41877) | FENGYUN 1C DEB (29798) | `2026-11-07T14:16:29Z` | **7.470 km** | 3.01e-11 | 3.21e-06 | `MONITORED` |
| **SL-8 R/B** (11574) | COSMOS 2251 DEB (47062) | `2026-11-07T06:20:22Z` | **3.415 km** | 1.37e-13 | 1.35e-06 | `WARNING` |
| **CARTOSAT-3** (44804) | COSMOS 2251 DEB (36047) | `2026-11-07T16:07:30Z` | **5.983 km** | 3.76e-14 | 4.65e-07 | `MONITORED` |
| **SL-16 R/B** (17590) | FENGYUN 1C DEB (32094) | `2026-11-07T02:32:21Z` | **5.025 km** | 1.87e-17 | 3.97e-06 | `MONITORED` |
| **SL-3 R/B** (877) | FENGYUN 1C DEB (30312) | `2026-11-07T13:38:23Z` | **7.355 km** | 8.05e-22 | 1.64e-06 | `MONITORED` |
| **SL-8 R/B** (19257) | FENGYUN 1C DEB (36274) | `2026-11-07T13:30:11Z` | **8.984 km** | 2.50e-25 | 5.78e-07 | `MONITORED` |
| **SL-14 R/B** (16882) | FENGYUN 1C DEB (30546) | `2026-11-06T23:07:22Z` | **12.309 km** | 5.63e-27 | 1.14e-06 | `MONITORED` |
| **CARTOSAT-2B** (36795) | FENGYUN 1C DEB (46990) | `2026-11-07T06:32:22Z` | **11.069 km** | 6.46e-40 | 5.49e-07 | `MONITORED` |

---

## 3. Explaining Variance in TCA and Miss Distance

1. **TLE Age & Atmospheric Drag Modeling ($B^*$):**
   Small differences in the epoch of the element sets (even 6 to 12 hours) produce along-track offsets of order $1 - 3\text{ km}$ due to unmodeled upper atmospheric density fluctuations and geomagnetic storms ($K_p$ index variation).
2. **Numerical Minimizer Tolerance:**
   OrbitGuard refines TCA to within $< 0.05\text{ seconds}$ using bounded 1-D Brent/Golden-section scalar minimization on the Euclidean range function $f(t) = \|\mathbf{r}_1(t) - \mathbf{r}_2(t)\|$. Coarse fixed-step screeners report TCA at the nearest grid point or quadratic fit vertex.
3. **Conservative Upper Bound ($P_{c,\text{max}}$):**
   Because public TLEs lack sensor covariance, OrbitGuard's Akella-Alfriend $P_{c,\text{max}}$ metric scales the covariance factor $k \in [0.01, 100]$ to identify the worst-case collision bound. This ensures that conjunctions with uncertain TLEs are never dangerously overlooked during screening.
