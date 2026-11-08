# India Orbit Watch user guide

## Start

The app opens to a 3D Earth and the catalog of public Indian-owner payloads. At present the checked snapshot has 77 records. Select a list item or its globe marker to show details. The native Windows title bar provides the standard minimize, maximize, and close controls.

## Globe

- Drag to rotate, scroll to zoom, and click a marker to select it.
- The orange line shows one propagated orbital period for the selected spacecraft.
- Cyan markers are records with recent elements; amber markers have elements older than seven days.
- The globe uses NASA Blue Marble Earth, cloud, night-lights, and ocean textures over a deterministic starfield. These are static global composites, not live imagery.
- Altitude is plotted linearly: 1 globe radius is 6,378.137 km. Selecting a geostationary object zooms the camera out to keep it visible, so Earth appears smaller while the orbit stays at its true plotted radius.

## Search and details

Search by object name or catalog number. Details include source catalog identifier and owner code, modelled latitude/longitude, altitude, speed, element epoch and age, inclination, and period. Overview shows an official spacecraft image, launch date, purpose, and official product archive when a verified profile is available. Missing mission facts or photos are labelled as unavailable. The position is recomputed once per second from the same catalog elements.

## Pass prediction

Open **Passes** and enter latitude, longitude, site altitude in metres, and minimum elevation mask. The app does not request or infer device location. **Predict next pass** searches up to 72 hours with SGP4 and a one-minute scan followed by a bounded crossing refinement. Results are predictions, not reception guarantees.

## Data status

The app checks the public manifest every minute and downloads catalog elements only after the snapshot timestamp changes. The public refresh pipeline is limited to two hours for GP/OMM elements and twelve hours for SATCAT. If the public branch is not available, the app identifies the bundled snapshot or cached snapshot and displays its recorded fetch time.

For official Earth-observation visuals, use the link to [ISRO Upagrah](https://bhoonidhi.nrsc.gov.in/upagrah). The app links to published, processed science/product archives where verified. It does not claim access to live spacecraft sensor/downlink telemetry. Source notes and texture attribution are in [DATA_SOURCES.md](DATA_SOURCES.md).
