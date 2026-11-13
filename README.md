# ISRO Orbit Watch

A Windows desktop app for viewing public orbital-element predictions for Indian spacecraft. It is an independent viewer, not an ISRO product. The globe updates each second by propagating public GP/OMM elements with SGP4. The catalog checks for a refreshed data snapshot once per minute; the data pipeline refreshes GP elements no more often than once per two hours.

## What the app shows

- Interactive NASA Blue Marble Earth globe with night lights, clouds, ocean highlights, a starfield, Indian spacecraft positions, and a one-orbit predicted ground path.
- Satellite altitude plotted at a true linear Earth-radius scale (1 scene unit = 6,378.137 km); the camera backs out for geostationary orbits so they remain visible.
- Searchable list and details: catalog ID, owner code, launch date when available, element epoch and age, predicted geodetic position, altitude, speed, inclination, and orbital period.
- Verified mission summaries and official spacecraft images for profiled missions, with links to public mission data portals when available. Unknown facts and missing images are labelled rather than inferred.
- Optional next-pass prediction for a manually entered observer location, altitude, and elevation mask.
- Explicit source and stale-data status, with a last-verified local cache for network outages.
- Links to ISRO's Upagrah tracker and public Earth-observation/science archives.

The position clock is current, but a current clock does not make the orbital elements live. SGP4 gives a modelled estimate from the element epoch. It is not a direct observation, spacecraft command link, live sensor feed, or telemetry downlink. Official portals can provide processed science or Earth-observation products; those products are not live engineering telemetry. See [data sources and image attribution](docs/DATA_SOURCES.md).

## Data and scope

The refresh pipeline joins CelesTrak GP/OMM records to CelesTrak SATCAT metadata by NORAD catalog number and accepts only payloads with the documented owner codes `IND` or `ISRO`. It does not infer Indian ownership from a name. Each accepted orbit record must have valid orbital fields and pass an SGP4 propagation check before the published catalog is replaced. Failed fetches or validation leave the last verified files in place.

- [CelesTrak GP/OMM format](https://celestrak.org/NORAD/documentation/gp-data-formats.php)
- [CelesTrak SATCAT format](https://celestrak.org/satcat/satcat-format.php)
- [CelesTrak usage policy](https://celestrak.org/usage-policy.php): GP data requests are limited to a two-hour cadence.
- [ISRO Upagrah](https://bhoonidhi.nrsc.gov.in/upagrah): official visual comparison for Earth-observation missions.

`frontend/public/data/meta.json` records the catalog fetch time, SATCAT metadata time, element epoch range, object count, and freshness threshold. The desktop app checks the public `main` branch manifest each minute and downloads changed elements only when the snapshot timestamp changes. It uses the bundled, dated snapshot when the public catalog is not reachable and labels that state clearly. GitHub Actions refreshes and commits the public files every two hours when enabled.

## Build on Windows

Requirements: Node.js 20 or newer and Python 3.10 or newer for refreshing the data.

```powershell
npm install
npm --prefix frontend install
python -m pip install -r requirements.txt
npm run build:web
npm start
```

Create Windows installer and portable executable:

```powershell
npm run dist:win
```

Artifacts are written to `release/`.

Run the orbit smoke check against the bundled 77-record catalog:

```powershell
npm run check:orbit
```

Refresh public data manually:

```powershell
python scripts/refresh_india_catalog.py
```

The fetcher enforces the two-hour GP cadence even when run manually. It refreshes SATCAT ownership metadata at most every 12 hours. It does not generate sample satellites or random values.

## Honest limitations

- Public orbital elements are predictions and can be stale or absent for some Indian spacecraft. Exact physical scale makes high-orbit objects appear farther from the Earth and therefore smaller on screen when the globe is framed to include them.
- App-side one-minute checks do not cause a source to publish more often. The source pipeline follows CelesTrak's two-hour GP policy.
- No general public ISRO spacecraft telemetry/downlink feed is assumed. Bhoonidhi and ISRO archives expose selected Earth-observation/science products, which are distinct from live engineering telemetry.
- This is not an operational collision-avoidance or spacecraft command system.
