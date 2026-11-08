# OrbitGuard / SOCRATES Validation Status

## Result

**No event-level cross-validation has been performed.** The repository utility only
checks whether the SOCRATES endpoint is reachable; it does not parse its records or
match them against OrbitGuard events. Historical sample comparisons and collision
probabilities have been withdrawn because they were not independently verified.

Collision probability is unavailable without measured covariance from an authoritative
Conjunction Data Message (CDM). GP/TLE screening can provide geometric miss-distance
candidates, but it does not establish an operational collision probability or a
validated maneuver warning.

No synthetic benchmark or substitute values are generated when a source is unavailable.
