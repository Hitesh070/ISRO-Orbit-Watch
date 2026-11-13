# Public data sources and freshness

## Orbital elements

The refresh task retrieves CelesTrak's active GP/OMM JSON group. Each orbital record is joined to SATCAT by numeric NORAD catalog identifier. It keeps only records whose SATCAT `OWNER` is `IND` or `ISRO`, and whose `OBJECT_TYPE` is `PAY`. The code does not infer ownership from names or use generated/sample orbit records.

Each record must include a parseable element epoch, plausible finite orbital values, and a successful SGP4 propagation at fetch time. The output catalog and manifest are atomically replaced only after the nonempty candidate set passes validation. A failed network request or failed validation leaves the previous published files intact.

- [CelesTrak GP/OMM formats](https://celestrak.org/NORAD/documentation/gp-data-formats.php)
- [CelesTrak SATCAT fields and query format](https://celestrak.org/satcat/satcat-format.php)
- [CelesTrak ownership codes](https://celestrak.org/satcat/sources.php)
- [CelesTrak usage policy](https://celestrak.org/usage-policy.php)
- [NASA Visible Earth planet textures](https://visibleearth.nasa.gov/collection/1484/planet-textures)
- [ISRO spacecraft missions](https://www.isro.gov.in/SpacecraftMissions.html)
- [ISRO Earth observation missions](https://www.isro.gov.in/ISRO_EN/EarthObservationSatellites.html)

CelesTrak's policy says GP updates occur every two hours and SATCAT is manually updated once or twice a day. The updater is capped at one GP retrieval every two hours and SATCAT refresh every twelve hours. SATCAT launch date and site fields are displayed when supplied by the feed. The application checks its public manifest once a minute; this only detects already-published changes and does not increase source polling.

## Globe imagery and scale

The globe uses bundled NASA Visible Earth Blue Marble imagery plus NASA global night-lights, cloud, and ocean-specular textures recovered from the project's earlier public-data assets. The images are static global composites, not live weather imagery or Google Earth tile imagery. The app attributes the source here and does not claim that NASA imagery is real-time. Google Earth imagery and tiles are not redistributed.

The globe uses 1 scene unit per 6,378.137 km Earth radius. Marker radius is `1 + altitudeKm / 6378.137`; heights are not compressed or clamped. Selecting a geostationary object moves the camera farther out so it remains visible at its actual plotted radius.

## Mission descriptions, images, data products and telemetry

[ISRO Upagrah](https://bhoonidhi.nrsc.gov.in/upagrah) is an official public visual tracker for Earth-observation missions. It is useful for comparison; ISRO Orbit Watch does not scrape it. The Overview panel links to official mission pages and data portals only for exact profiles. It currently includes AstroSat archive access, NISAR Earth-observation products through Bhoonidhi, INSAT-3DS products through MOSDAC, and Bhoonidhi access for Cartosat-3 and EOS-06. Download access and product coverage are controlled by each official portal and can require registration.

[Bhoonidhi's API](https://bhoonidhi.nrsc.gov.in/bhoonidhi-api/) requires account registration and an access token and concerns Earth-observation products. [ISRO's science archives](https://www.isro.gov.in/Sciencedata.html) publish selected mission/science data. These are not a general public engineering-telemetry/downlink feed. The app therefore makes no claim to show received spacecraft sensor telemetry, spacecraft commands, or private TTC data. Data product links point to source archives; the app does not claim that source imagery is being streamed into the globe.

## What “current position” means here

The clock in the app is the device's current clock. The displayed position is a prediction calculated from the selected record's element epoch using SGP4. If an element set is old, its age is shown and an amber marker/warning appears; after the manifest freshness threshold, the app announces a stale snapshot. A fresh device clock never makes stale elements fresh.

The desktop app reads its public catalog from this repository's `main` branch. The bundled dated snapshot is used when the public catalog cannot be reached. Published snapshot times are shown in the app; a current UI clock does not make the catalog or its elements live.
