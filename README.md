# OrbitGuard 🛰️
### Real-Time Satellite Orbit Tracker & Space Debris Risk Dashboard

[![Vercel Deployment](https://img.shields.io/badge/Vercel-Live%20Deployment-000000.svg?style=flat&logo=vercel)](https://orbit-guard-tan.vercel.app)
[![GitHub Repository](https://img.shields.io/badge/GitHub-Hitesh070%2FOrbit--Guard-181717.svg?style=flat&logo=github)](https://github.com/Hitesh070/Orbit-Guard)
[![FastAPI](https://img.shields.io/badge/Backend-FastAPI%20%7C%20Python%203.12-009688.svg?style=flat&logo=fastapi)](https://fastapi.tiangolo.com)
[![Skyfield](https://img.shields.io/badge/Astrodynamics-Skyfield%20%2B%20SGP4-blue.svg?style=flat)](https://rhodesmill.org/skyfield/)
[![React](https://img.shields.io/badge/Frontend-React%20%7C%20Vite-61DAFB.svg?style=flat&logo=react)](https://reactjs.org/)
[![Three.js](https://img.shields.io/badge/3D%20Graphics-Three.js%20%7C%20R3F-black.svg?style=flat&logo=three.js)](https://threejs.org/)

**OrbitGuard** is an advanced, production-grade space situational awareness (SSA) web platform that tracks operational spacecraft and cataloged space debris in real time, evaluates conjunction collision probabilities, predicts ground station line-of-sight passes, and models orbital debris risk distributions across Low Earth Orbit (LEO), Medium Earth Orbit (MEO), and Geostationary Orbit (GEO).

---

## 🌐 Live Production Deployment

- **Public Web Application**: [https://orbit-guard-tan.vercel.app](https://orbit-guard-tan.vercel.app)
- **GitHub Repository**: [https://github.com/Hitesh070/Orbit-Guard](https://github.com/Hitesh070/Orbit-Guard)

---

## 🌟 Key Features

### 1. Astronomical 3D Earth Globe with Real-Time Day/Night Terminator
- High-resolution 3D Earth mesh with **NASA Blue Marble** day mapping and nighttime city lights emissive maps.
- **Astronomical Sun Vector**: Earth's illumination terminator is calculated mathematically from the exact current UTC solar declination and subsolar longitude, reflecting real-world daylight and night across continents.
- **Dynamic Cloud Layer**: Realistic cloud sphere with atmospheric drift and depth blending.
- **Rayleigh Scattering Atmosphere**: Soft blue cyan rim shader simulating atmospheric light refraction against deep space.
- **Continuous Sub-Second SGP4 Motion**: Satellites glide visibly across the globe on every animation frame ($60\text{ fps}$) based on microsecond-precision orbital physics.
- **Interactive Inspection**: Clean top-right docked telemetry card with live ticking altitude, velocity vector, sub-satellite coordinates, and risk assessment (no screen-blocking modals).

### 2. Space Debris Risk & Conjunction Engine
- **Quantitative Conjunction Risk Formula**:
  $$\text{Risk Score} = \frac{\text{nearby\_debris\_count} \times \bar{v}_{\text{rel}}}{\text{altitude\_factor}}$$
- Spatial proximity checks (<80 km threshold), relative encounter speeds ($8\text{--}14\text{ km/s}$), and collision probabilities.
- **24-Hour Conjunction Alerts Feed**: Automated screening of close approaches $<30\text{ km}$ miss distance with live countdown timers ticking down to Time of Closest Approach (TCA).
- **One-Click 3D Visualization**: Clicking any conjunction alert highlights both objects on the 3D globe and positions the camera at the encounter geometry.

### 3. GPS Browser Geolocation & Ground Station Pass Predictor
- Automatic browser GPS detection (`navigator.geolocation`) resolves user's real latitude, longitude, and local timezone.
- Predicts upcoming line-of-sight passes (AOS, Culmination/Max Elevation, LOS, Duration) for ISS (ZARYA) and Indian ISRO satellites (Cartosat, RISAT).
- Generates 2D sub-satellite orbital ground track coordinates ($\pm 45$ minutes around current epoch).

### 4. Macro Analytics & SSA Dashboard
- Operational Spacecraft vs Space Debris vs Spent Booster Stages breakdown pie chart.
- Orbital Altitude Distribution Histogram ($200\text{ km} \to 36,000\text{ km}$).
- Space Age Historical Launch Trend ($1960\text{--}2026$), charting ASAT fragmentation events and mega-constellation deployments.
- Top 10 Spacefaring Nations / Operating Agencies distribution.
- 2D Altitude $\times$ Inclination Collision Density Heatmap.

---

## 🏷️ Version History

- **v1.0**: Initial OrbitGuard Core Release (FastAPI backend, Three.js 3D Earth, Skyfield SGP4 propagation, Risk Engine, Conjunction Alerts, Pass Predictor).
- **v1.1**: Fixed satellite popup full-screen overflow, locked pure space dark mode, added dual Local / UTC orbital clocks, and integrated browser GPS geolocation auto-detection.
- **v2.0**: Integrated continuous sub-second client-side SGP4 propagation engine (`satellite.js`), real-time astronomical solar terminator shaders, dynamic cloud atmospheric drift, and Vercel cloud deployment.
- **v2.1**: Optimized Vercel Serverless Function response times and high-performance propagation caching.

---

## 🛠️ Architecture & Tech Stack

- **Frontend**: React 18, Vite, Three.js, React Three Fiber (`@react-three/fiber`), `@react-three/drei`, Tailwind CSS, Recharts, Zustand, `satellite.js`, Axios, Lucide Icons.
- **Backend**: Python 3.12, FastAPI, Skyfield (NASA JPL ephemerides), SGP4, APScheduler, httpx, pandas, numpy.
- **Deployment**: Vercel Global Edge Network with Python Serverless Functions.
- **Data Sources**: Official NORAD / CelesTrak / Space-Track TLE feeds.

---

## 🎓 Resume Highlights for ISRO & HAL Interviews

1. **Astrodynamics & Orbit Determination**: The SGP4 analytical propagation model accounts for Earth oblateness ($J_2, J_3, J_4$), atmospheric drag decay, and third-body lunar/solar gravitational perturbations on Keplerian orbital elements.
2. **Space Situational Awareness (SSA)**: Formulates close-approach screening geometry, Euclidean miss distances at Time of Closest Approach (TCA), and Collision Avoidance Maneuver (CAM) $\Delta v$ planning.
3. **High-Performance Full-Stack Engineering**: Sub-second continuous WebGL rendering pipeline synchronized with asynchronous Python astrodynamics microservices and global Vercel serverless deployment.
