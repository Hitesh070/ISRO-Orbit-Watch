# Build and data validation report

**Target branch:** `main`
**Snapshot retrieved:** 2026-11-08 14:54:54 UTC
**Build runtime:** Electron 45.2.3

## Completed checks

- The CelesTrak SATCAT active-payload query returned data in the documented JSON format.
- The GP/OMM and SATCAT datasets joined on NORAD catalog ID; 77 India-owned active payload records passed field and SGP4 propagation validation.
- The published snapshot has 77 distinct catalog IDs, only `IND` ownership codes, only `PAY` object types, and matches its manifest count.
- The frontend passed strict TypeScript compilation and a production Vite build. The production bundle is split into UI, mapping, SGP4, and globe-engine assets.
- `node scripts/orbit_smoke.mjs` propagated all 77 records and validated geodetic coordinates, altitude, speed, and a 145-point orbit track. It found an ASTROSAT next pass over Bengaluru with 16.7° maximum elevation in the 72-hour search window. It also verifies scale: 525 km = 1.082 Earth radii; 35,786 km = 6.611 Earth radii.
- The Earth uses bundled NASA Blue Marble day, night-lights, cloud, and ocean texture assets. The starfield is deterministic and does not use a random generator.
- Verified image, launch date, mission purpose, and data archive details are available for AstroSat, NISAR, INSAT-3DS, Cartosat-3, EOS-06, and GSAT-30. Profile image URLs were checked against ISRO-hosted files. Other spacecraft show only SATCAT launch date when present and clearly label unverified descriptions/images as unavailable.
- The Electron main process passed Node syntax checking. The packaged app contains the main process, frontend, textures, catalog, and mission profiles.
- Windows NSIS setup and portable x64 executables were rebuilt in `release/`. The executables are unsigned because no code-signing certificate is configured.
- Electron is pinned to the then-current stable supported release line (45.2.3). `npm audit` reported zero vulnerabilities after pinning the packaging transitive dependency.
- The data pipeline's two-hour GP cadence and twelve-hour SATCAT cadence are enforced in code; failed updates preserve the prior catalog.
- The app has no generated satellite coordinates, mock catalog, name-based ownership inference, location permission request, or remote font dependency. Decorative stars use a fixed deterministic layout.

## Manual desktop check

The rebuilt portable app was opened on this Windows device and checked with mouse input. The NASA Earth texture and stars rendered; mouse drag rotated the globe; mouse-wheel zoom changed its framing; search and spacecraft selection worked; AstroSat and NISAR mission profiles displayed their official images, launch dates, purpose and data archive links; GSAT-30 displayed a geostationary radius and its verified mission profile; Overview, Passes and About tabs worked. AstroSat next-pass prediction over Bengaluru returned a pass with a 16.7° maximum elevation.

The later marker redesign replaces dots with 3D spacecraft icons, selection glow, and amber stale-data coloring. It passed compilation, orbit checks, and Windows packaging. The marker redesign itself has not yet been manually inspected in the open window.

The first manual run happened before the replacement was published and therefore used its bundled snapshot. After publication, the GitHub `main` manifest and catalog endpoints were verified to return the 77-record India-only snapshot. The already-open desktop window had not yet visibly confirmed its next scheduled online refresh when the UI check ended. The app does not provide live ISRO telemetry.

## Accuracy limits

The list represents SATCAT owner-country metadata (`IND`/`ISRO`) and payload object type; it does not assert that every listed payload is built or operated by ISRO. Orbit positions are SGP4 predictions from element epochs, not live tracking sensor telemetry. Earth textures are static composites, not live imagery. A real one-to-one physical scale means geostationary spacecraft appear much farther from Earth; the camera backs out when one is selected.
