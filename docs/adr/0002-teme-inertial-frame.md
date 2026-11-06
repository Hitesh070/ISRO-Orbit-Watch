# ADR 0002: Inertial TEME Coordinate Frame with GMST Earth Mesh Rotation

## Status
Accepted

## Context
In OrbitGuard v2.1, satellite positions computed by `satellite.js` in TEME (True Equator, Mean Equinox) were converted into Greenwich Mean Sidereal Time (GMST) and then into geodetic latitude/longitude and spherical Cartesian coordinates ($x = r \cos \phi \sin \lambda, y = r \sin \phi, z = r \cos \phi \cos \lambda$).

The Earth globe mesh was rendered stationary at $0^\circ$ rotation, placing all satellites in an Earth-Centered, Earth-Fixed (ECEF) rotating frame.

This created two severe issues:
1. **Computational Bottleneck:** Computing trigonometric spherical conversions ($\sin, \cos$) for $N$ satellites on every frame ($60\text{ fps}$) creates an $O(N)$ CPU bottleneck on the main JavaScript thread, prohibiting scaling to 25,000+ catalog objects.
2. **Distorted Orbit Paths:** Computing an orbit trajectory over one future period in ECEF incorporates the Earth's $\sim 24^\circ$ rotation under the satellite. This produces an S-shaped ground track in 3D rather than a planar, closed Keplerian ellipse.

## Decision
1. **Retain Native Inertial Coordinates:**
   - Keep all satellite positions and orbit trajectories in native **TEME / ECI Cartesian coordinates** directly from SGP4.
   - Do not perform per-satellite geodetic conversions during the rendering loop.
2. **Apply Earth Rotation to Globe Mesh:**
   - Apply a single continuous rotation to the 3D Earth sphere around its polar axis equal to Greenwich Mean Sidereal Time:
     $$\theta_{\text{Earth}} = \text{GMST}(t)$$
   - Convert to topocentric frames (Azimuth, Elevation) only on-demand when analyzing a specific ground station.

## Consequences
* **Positive:** Eliminates tens of thousands of trigonometric operations per tick; orbit lines are closed planar ellipses; day/night solar terminator aligns naturally with UTC time.
* **Negative:** Subpoint display requires on-demand conversion for the single selected satellite only (negligible compute).
