# Conjunction Screening & Collision Probability

## What the application reports

OrbitGuard can propagate public GP/TLE elements and, when a verified event snapshot with explicit coverage is available, present geometric screening information. Such values are estimates from catalog elements. They are not live sensor observations or maneuver instructions.

The v5.0 bundled conjunction snapshot is withdrawn because earlier collision-probability outputs relied on synthetic covariance. When no verified screening snapshot is available, the UI says “Screening unavailable.” An unavailable or empty table is not evidence that an orbit is clear.

## Probability requirements

A physically meaningful collision probability requires, at minimum, a relative state at time of closest approach, measured state covariance from an authoritative source, and a defined combined hard-body radius. Public GP/TLE elements alone do not supply those uncertainty and object-size inputs. OrbitGuard therefore does not derive or substitute probability from TLE age, object count, distance class, or random values.

The mathematical integral below describes the general two-dimensional encounter-plane calculation. It is not a claim that the current public-catalog pipeline has the covariance inputs needed to run it:

$$P_c = \frac{1}{2\pi\sqrt{\det C}} \iint_{\|x\|\le R} \exp\left(-\frac{1}{2}(x-m)^T C^{-1}(x-m)\right)\,d^2x$$

where $m$ is the miss vector in the encounter plane, $C$ is a measured projected covariance, and $R$ is the combined hard-body radius. If any required input is absent or invalid, report probability as unavailable.

## Validation

The active app/API behavior and release test status are recorded in [`../RELEASE_V5.0.md`](../RELEASE_V5.0.md). Prior descriptions of generated RTN covariance, Foster probability outputs, or verified event-level comparison are historical and are not evidence of v5.0 screening coverage.
