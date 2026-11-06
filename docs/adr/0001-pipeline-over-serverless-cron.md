# ADR 0001: Automated GitHub Actions Pipeline over Serverless Cron

## Status
Accepted

## Context
In early prototypes (v1.0 – v2.1), TLE data fetching was managed by Python's `APScheduler` (`BackgroundScheduler`) initiated in FastAPI's startup lifespan (`backend/tle_fetcher.py`).

When deployed to modern serverless environments (Vercel Serverless / AWS Lambda), execution units are ephemeral microVMs that freeze or terminate immediately after handling an HTTP request. Background threads cannot wake up or persist across invocations. As a result, TLE updates were never executed automatically, leaving the system running on stale deploy-time snapshots.

Furthermore, bundling heavy scientific libraries (`skyfield`, `pandas`, `numpy`, `scipy`) inside serverless lambdas increased deployment package sizes to $>100\text{ MB}$ and introduced cold-start latencies of $1.7\text{ s} \text{ to } 2.5\text{ s}$.

## Decision
1. **Decouple Data Ingestion from Web Serving:**
   - Implement `scripts/pipeline/fetch_catalog.py` driven by a **GitHub Actions Cron Workflow** (`.github/workflows/refresh-data.yml`) executing every 6 hours.
   - The workflow queries CelesTrak OMM/GP JSON, validates element sets, tags decayed objects, and serializes compact `catalog.json.gz` (456 KB) and provenance metadata `meta.json`.
   - The generated artifacts are committed to the repository and served directly via static CDN.
2. **Shift Real-Time Computation to the Client:**
   - Migrate ground pass predictions and real-time SGP4 propagation to client-side TypeScript (`satellite.js`).
   - Eliminate heavy runtime dependencies from the Vercel function, reducing serverless cold starts to $<100\text{ ms}$.

## Consequences
* **Positive:** Guaranteed 6-hour refresh cadence independent of web traffic; 0 ms server delay for pass predictions; zero cold-start crashes; offline resilience via bundled fallback snapshots.
* **Negative:** GitHub Actions runner limits (though 6h cron uses negligible minutes against GitHub free-tier quotas).
