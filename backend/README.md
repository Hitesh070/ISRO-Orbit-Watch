# OrbitGuard Backend & Offline Screening Pipeline 🛰️

The **OrbitGuard Backend** contains the Python-based astrodynamics computation routines, automated CelesTrak catalog ingestion pipeline, and high-precision conjunction screening engine.

---

## 🔬 Astrodynamics & Conjunction Pipeline

1. **Automated Catalog Ingestion (`scripts/pipeline/fetch_catalog.py`)**:
   - Queries CelesTrak's CCSDS OMM/GP JSON API across active satellites and major debris fields (Fengyun-1C, Cosmos-2251, Iridium-33).
   - Validates physical orbital sanity (perigee $r_p > -200\text{ km}$, eccentricity $e < 1.0$) and computes element set freshness.
   - Serializes compressed `catalog.json.gz` and metadata `meta.json` for web CDN distribution and desktop fallback snapshots.
2. **24-Hour Conjunction Screener (`scripts/pipeline/screen_conjunctions.py`)**:
   - SGP4 propagation along a 24-hour temporal grid (30s time steps).
   - Spatial indexing using `scipy.spatial.cKDTree` with dynamic step-velocity ball radius bounding.
   - Linearized Time-of-Closest-Approach (TCA) filtering followed by continuous scalar minimization (`scipy.optimize.minimize_scalar`) on the SGP4 Euclidean separation function $f(t) = \|\mathbf{r}_1(t) - \mathbf{r}_2(t)\|$ to $< 0.05\text{ s}$ precision.
3. **Conjunction Probability Engine (`scripts/pipeline/conjunction_engine.py`)**:
   - Evaluates the **Foster-1992** 2-D collision probability integral over the combined hard-body radius on the encounter plane perpendicular to relative velocity:
     $$P_c = \frac{1}{2\pi \sqrt{\det \mathbf{C}_{2D}}} \iint_{\text{Disk}(R_{\text{HBR}})} \exp\left(-\frac{1}{2}(\mathbf{r} - \mathbf{m})^T \mathbf{C}_{2D}^{-1} (\mathbf{r} - \mathbf{m})\right) d^2\mathbf{r}$$
     using 64-point Gauss-Legendre quadrature.
   - Evaluates **Akella-Alfriend (2000)** maximum probability $P_{c,\text{max}}$ across synthetic covariance scaling factors $k \in [10^{-2}, 10^2]$.
   - Performs Radial-Transverse-Normal (RTN) miss vector decomposition with 100.0% variance partitioning: $(R^2 + T^2 + N^2) / \|\mathbf{m}\|^2 = 1.000$.

---

## 📂 Directory Structure

```
backend/
├── conjunction.py          # Conjunction assessment and collision probability logic
├── main.py                 # FastAPI application and REST endpoints
├── pass_predictor.py       # Topocentric pass planning and AOS/TCA/LOS refinement
├── propagator.py           # Python SGP4 propagation wrappers
├── risk_engine.py          # Altitude x Inclination risk density matrix generator
├── tle_fetcher.py          # Direct CelesTrak OMM client
├── requirements.txt        # Production Python dependencies
└── Dockerfile              # Container configuration for standalone server deployment
```

---

## 🧪 Testing & Verification

```bash
# Run backend Pytest suite (15 tests: SGP4 validation, Foster Pc, RTN decomposition)
pytest tests/ -v

# Run Python code linting via Ruff
ruff check backend scripts tests api
```
