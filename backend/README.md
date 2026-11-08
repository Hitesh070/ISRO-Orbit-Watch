# OrbitGuard Backend & Offline Screening Pipeline 🛰️

The **OrbitGuard Backend** contains Python astrodynamics routines and catalog/screening pipeline tools. Its outputs are only as current and complete as the source snapshots and declared processing coverage.

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
3. **Conjunction screening and probability limits**:
   - Public GP/TLE elements can be propagated to identify geometric close-approach candidates when source time and screening coverage are available.
   - The bundled v5.0 event data was withdrawn because its former probability values depended on synthetic covariance. The UI reports screening unavailable when no verified snapshot is available.
   - Collision probability requires measured covariance and hard-body data from an authoritative CDM. No synthetic covariance, probability, or risk classification is substituted.
   - Pass predictions require explicit observer latitude, longitude, altitude, and usable element data.

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
# Run the current backend Pytest suite
pytest tests/ -v

# Run Python code linting via Ruff
ruff check backend scripts tests api
```
