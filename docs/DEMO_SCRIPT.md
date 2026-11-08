# OrbitGuard v5.0 — Honest Feature Walkthrough

This script demonstrates only behavior that can be observed from the packaged catalog snapshot. Values change when the snapshot changes. Do not present model predictions as live measurements or unavailable screening as evidence of a clear orbit.

## Walkthrough

1. **Open the 3D Globe.** Show the source timestamp and freshness banner before selecting an object. Explain that SGP4 propagates catalog elements to the selected simulation time; it is not live sensor telemetry.
2. **Use search and filters.** Search by name or NORAD ID, toggle satellites/debris/orbits/clouds, and use the asset filters. Select an object and describe its altitude, velocity, inclination, period, and sub-satellite location as model-predicted values.
3. **Open Analytics & Risk.** Compare ISRO-only and all-assets views. Identify catalog counts as counts of records in the loaded snapshot. Explain that an unavailable mean velocity is left unavailable rather than filled with an assumed value.
4. **Open Conjunctions.** If no verified event snapshot is loaded, show “Screening unavailable.” Explain that this is not clearance evidence and that public GP/TLE records do not provide measured covariance or hard-body data needed for collision probability.
5. **Open RF Station.** Show the site, target frequency, selected pass, and elevation mask state. If any required value is unavailable, explain why Doppler and link-budget results cannot be computed. A configured model input must be labelled as an input, not measured telemetry.
6. **Review Antenna Rotator Control.** Demonstrate the virtual simulator only. Do not connect or move physical equipment as part of a general product demo. A real device requires operator review of the transport, limits, and stop path.

## Safe narration

“OrbitGuard provides an interactive view of timestamped public orbital elements propagated with SGP4. The catalog and prediction are only as current as their source data. This installation's conjunction screen is unavailable, so it cannot establish that an orbit is clear. It reports unavailable values instead of fabricating covariance, probabilities, station measurements, or carrier data.”
