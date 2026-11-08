# OrbitGuard Data Sources, Provenance & Attribution

This document describes upstream orbital data used by OrbitGuard and the limits of the packaged snapshot. The application does not receive live tracking telemetry. Its displayed positions are SGP4 predictions from timestamped catalog elements.

---

## 1. Primary Orbital Data Feeds

### 1.1 CelesTrak (Center for Space Standards & Innovation)
* **Provider:** Dr. T.S. Kelso / CelesTrak
* **URL:** [https://celestrak.org](https://celestrak.org)
* **Format:** CCSDS Orbit Mean-Elements Message (OMM) in JSON format (`FORMAT=json`) and standard Two-Line Element (TLE) sets.
* **Groups Ingested:**
  - `stations`: International Space Station (ISS), Tiangong Space Station (CSS), crewed spacecraft.
  - `visual`: 100+ brightest satellites visible to naked eye / optical ground stations.
  - `weather`: Meteorological satellites (NOAA, GOES, Meteosat, INSAT-3DR, Fengyun).
  - `resource`: Earth observation assets (Landsat, Sentinel, Cartosat, Resourcesat, Terra, Aqua).
  - `science`: Astrophysical & scientific observatories (Hubble, Astrosat, CHEOPS).
  - `gnss`: Navigation constellations (GPS Navstar, Galileo, GLONASS, NavIC / IRNSS).
  - `geo`: Geostationary telecommunications & broadcasting satellites.
  - `cosmos-2251-debris`: Debris fragments from the 2009 Cosmos-2251 / Iridium-33 collision.
  - `iridium-33-debris`: Fragments from the Iridium-33 collision.
  - `INTDES=1999-025`: 1,900+ tracked fragments from the 2007 Fengyun-1C ASAT event.
* **Update Frequency:** The repository's scheduled pipeline is configured to run periodically (see `.github/workflows/refresh-data.yml`); a schedule is an attempted refresh, not a freshness guarantee. Desktop builds and offline installs use the bundled snapshot until a valid refresh succeeds. The app displays the snapshot timestamp and marks data older than six hours as stale.
* **Citation & Attribution:**
  > Kelso, T.S., "CelesTrak: Educational and Operational Astrodynamics Data", Center for Space Standards & Innovation (CSSI). Data redistributed under CelesTrak open educational and scientific terms.

---

### 1.2 Space-Track.org (18th Space Defense Squadron, USSF)
* **Provider:** Combined Space Operations Center (CSpOC) / 18th SDS.
* **URL:** [https://www.space-track.org](https://www.space-track.org)
* **Format:** General Perturbations (GP) class data via REST API.
* **Authentication:** Secure server-side basic authentication via `SPACETRACK_USER` and `SPACETRACK_PASS`.
* **Terms of Use Notice:** In compliance with Space-Track's User Agreement, raw bulk catalog dumps requiring authentication are processed server-side or in private pipeline runners; only derived client-safe positional buffers and screening results are presented to end users.

---

### 1.3 ISRO & National Asset Tracking
* **Indian Space Research Organisation (ISRO):**
  - High-priority assets monitored: Cartosat-2B, Cartosat-3, RISAT-2BR1, EOS-04, GSAT-30, INSAT-3DR, NavIC (IRNSS-1A through 1I), Chandrayaan, and Aditya-L1 relay orbits.
  - Satellite IDs, international designators, and orbital characteristics cross-checked against ISRO public mission disclosures.

---

## 2. Graphical & Ephemeris Assets

### 2.1 NASA Visible Earth
* **Provider:** NASA Goddard Space Flight Center / Visible Earth Team.
* **Assets:**
  - `earth_daymap.jpg`: NASA Blue Marble: Next Generation (2048x1024 cylindrical equidistant projection).
  - `earth_nightmap.jpg`: Earth at Night / City Lights composite.
  - `earth_clouds.jpg`: Moderate Resolution Imaging Spectroradiometer (MODIS) cloud layer mosaic.
* **Licensing:** Public domain NASA imagery.

---

## 3. SGP4 Reference Data & Verification Standards

### 3.1 AIAA 2006-6753 Benchmark
* **Reference:** Vallado, D. A., Crawford, P., Hujsak, R., and Kelso, T. S., *"Revisiting Spacetrack Report #3,"* AIAA/AAS Astrodynamics Specialist Conference, Keystone, CO, 2006.
* **Verification File:** `SGP4-VER.TLE` with companion C++ reference output `tcppver.out`.
* **Standard Tolerances:**
  - Position: $\Delta r < 10^{-3}\text{ km}$ ($1\text{ meter}$)
  - Velocity: $\Delta v < 10^{-5}\text{ km/s}$ ($10\text{ mm/s}$)
