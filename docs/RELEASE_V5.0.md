# OrbitGuard v5.0 Manual Review & Validation Report

**Review date:** 2026-11-08  
**Application reviewed:** v4.3 runtime before rebuild; v5.0 packaged build after rebuild  
**Review method:** Mouse navigation through the visible application; source and automated checks in the repository  
**Catalog shown during review:** CelesTrak CCSDS OMM/GP snapshot generated 2026-11-08 04:16:07 UTC

## Result

The inspected sections rendered and responded to navigation. The current cached catalog is stale, and some functions correctly remain unavailable because the required source data or station inputs are absent. The UI did not substitute random/demo values for unavailable conjunction probabilities, carrier frequency, station location, pass data, or rotator telemetry.

The open v4.3 runtime was reviewed first, then the v5.0 packaged executable was launched and its startup/globe, Analytics, Conjunctions, and RF Station views were rechecked. The Analytics chart scope mismatch found in review was corrected so its debris shell and distribution charts follow the ISRO/all-assets filter. The pass planner now states when a station or spacecraft must be selected instead of remaining indefinitely in an evaluating state. Hardware motion, GPS acquisition, and external mission/radio services were not exercised.

## Manual section checks

| Section | What was checked | Observed result |
|---|---|---|
| 3D Globe | Globe render, Center Earth, layer toggles, ISRO filter, search by NORAD 40544, selected-object dossier, simulation speed controls | Earth and catalog points rendered; Center Earth restored focus after a blank camera view; filters/search changed the view and asset counts. GSAT0203 / NORAD 40544 displayed SGP4-derived values. The view is a catalog prediction, not sensor telemetry. |
| Analytics & Risk | ISRO-only and all-assets filters, summary cards, population/histogram charts, 2026 launches, shell/heatmap counts | ISRO filter showed 78 assets; after the v5.0 scope fix its debris chart showed zero ISRO debris rather than the global 2,673. In all-assets mode the cards showed 3,782 loaded records, 1,109 active satellites, and 2,673 debris/rocket bodies. Mean LEO velocity remained unavailable. The packaged debris subset in this snapshot is LEO, so global MEO/GEO debris counts were zero. |
| Conjunctions | Status, filters, table, export controls and scientific caveats | “Screening unavailable” with no verified snapshot. The page explicitly says that this does not establish the orbit is clear. Collision probability is unavailable without measured covariance and physical hard-body data. No event-level results were available to inspect. |
| RF Station | Station state, target selection, elevation mask, polar plot, Doppler view, link-budget tab, rotator tab, pass list, missing-input messaging | Station location and target carrier were unavailable; no pass above the 13° mask was loaded in the next 72 hours. Doppler/link outputs therefore did not invent values. The pass planner requested a catalog spacecraft selection. Rotator controls reported no telemetry. No GPS request or hardware command was issued. |
| Global status | Clock, catalog provenance and data-age warnings | Clock advanced; the banner identified the CelesTrak source, snapshot timestamp, age greater than six hours, unavailable screening time/coverage, and seven catalog records omitted by the current TLE propagator. |

## Data accuracy and limits

- Catalog-derived positions are SGP4 predictions from element sets. A changing clock or smooth animation does not make the source observations live.
- The visible snapshot is over six hours old and therefore stale by the app's displayed threshold. It should be refreshed before use where newer catalog data is required.
- A newer automated catalog refresh present on GitHub was not adopted into this release: its metadata reports a fetch time of `2026-11-08T13:06:11Z` but a newest element epoch of `2026-11-10T19:43:23Z`, later than the fetch time. That timestamp inconsistency needs validation against the source before the refreshed snapshot is used.
- Seven records were omitted because their NORAD IDs could not be represented by the current TLE propagator.
- Conjunction screening is unavailable in this snapshot. An empty/unavailable table is not a “clear orbit” result.
- No collision probability is supported without measured covariance and physical hard-body data from an authoritative CDM. Synthetic covariance and random fallback values are not used for release output.
- RF calculations require a verified site, carrier, usable orbital elements, and a pass. Hardware control additionally requires a compatible, connected device; no physical movement was tested.

## Automated verification

| Check | Result |
|---|---|
| Frontend Vitest | 46 passed (11 files) |
| Desktop Vitest | 33 passed (3 files) |
| Frontend TypeScript check | Passed |
| Desktop TypeScript check | Passed |
| Backend numerical/screening tests | 10 passed (SGP4 validation, conjunction math, screening core) |
| Backend API endpoint tests | Inconclusive: first TestClient GET stalled in the installed FastAPI 0.162 / Starlette 1.10 / httpx 0.28 environment; repository pins FastAPI 0.111 / httpx 0.27 |
| v5.0 web/Electron compilation | Passed |
| v5.0 Windows package | Built; installer, portable EXE and ZIP produced |
| v5.0 packaged app startup | Launched; globe and Analytics view rendered |
| v5.0 pass-planner unavailable-input state | Manually checked; missing spacecraft/location prompt shown, with no fabricated pass |

The API tests remain unverified in this environment. The pass-prediction route itself was manually observed only in its unavailable-input state, not through a successful API test request.

## Release acceptance notes

1. Do not advertise this release as providing live sensor tracking or validated operational conjunction alerts.
2. Keep snapshot timestamps, freshness warnings, source, exclusions, and coverage visible.
3. Treat missing/withdrawn screening data as unavailable, not as zero risk.
4. Do not connect a physical rotator until its port, protocol, movement limits, stop path, and attached hardware have been reviewed by the operator.
