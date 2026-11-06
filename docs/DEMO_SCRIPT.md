# OrbitGuard — 90-Second Technical Demo & Presentation Script
**Author**: Electrical & Electronics Engineering (EEE) Specialization  
**Target Audience**: ISRO Scientist/Engineer 'SC' Recruitment Board, HAL Design Trainee Technical Panel, Aerospace Engineering Recruiters  
**Platform URL**: [https://orbit-guard-tan.vercel.app](https://orbit-guard-tan.vercel.app)  
**Total Running Time**: Exactly 90 Seconds (1 minute, 30 seconds)

---

## Technical Elevator Pitch (Memorize This)
> *"OrbitGuard is an astrodynamics-grade Space Situational Awareness and RF Ground Station platform. It renders 25,000+ catalogued celestial objects at a steady 60 FPS in the TEME frame, evaluates industry-standard Foster-1992 collision probability ($P_c$) and Akella $P_{c,\text{max}}$ bounds, computes topocentric RF Doppler shift compensated for Earth's equatorial rotation ($\mathbf{v}_{\text{obs}} = 465\text{ m/s}$), and autonomously drives dual-axis antenna positioners via embedded GS-232 and ESP32 stepper firmware."*

---

## Cue-by-Cue Walkthrough

| Time (s) | On-Screen Action | Spoken Narration (Word-for-Word Script) | Key Engineering Rigor Highlighted |
| :--- | :--- | :--- | :--- |
| **0:00 – 0:15** | Open `Home` 3D Globe (`/`). Spin Earth globe slightly, press `~` to display the Performance HUD showing 60 FPS and worker latency (~8ms). Zoom into LEO shell. | *"Hello. This is **OrbitGuard**, a Space Situational Awareness and RF ground-station platform. Right now, the system is propagating thousands of catalogued satellites and debris pieces forward in time directly in the browser. To eliminate UI thread blocking, numerical SGP4 propagation is decoupled into a background Web Worker using zero-copy transferable `Float32Array` buffers. Our custom GPU shader linearly extrapolates positions at 60 frames per second in the True Equator, Mean Equinox (TEME) celestial inertial frame, while Earth rotates underneath according to Greenwich Mean Sidereal Time."* | Web Worker zero-GC pipeline; TEME vs ECEF reference frames; GPU linear velocity extrapolation. |
| **0:15 – 0:35** | Click on the **ISS (ZARYA)** (NORAD 25544) or an Indian ISRO asset (e.g. **CARTOSAT-2B**). The live dossier opens on the right. Show the ticking sub-second altitude, velocity vector, and TLE epoch freshness badge. | *"Clicking any spacecraft executes screen-space GPU color-ID picking, docking its real-time telemetry dossier. Here, coordinates and velocity are updated at 100 milliseconds. Notice our element-set freshness indicator: public TLE accuracy degrades by 1 to 3 kilometers per day in LEO due to unmodeled upper-atmospheric drag fluctuations, which is why OrbitGuard labels all public-data predictions as screening-grade."* | SGP4 atmospheric decay; $B^*$ ballistic coefficient; scientific transparency on TLE age. |
| **0:35 – 0:55** | Click **Conjunctions** (`/conjunctions`) in the top navigation bar. Select a critical event (e.g. `ISS vs FENGYUN 1C DEBRIS`). Open the **Encounter Plane Drawer**. | *"Moving to the **Conjunction Assessment Engine**, we reject arbitrary density heuristics in favor of industry-standard 2D encounter-plane mathematics. Using 64-point Gauss-Legendre quadrature, OrbitGuard integrates the bivariate Gaussian probability density over the combined Hard Body Radius disk to compute Foster-1992 collision probability ($P_c$). To guard against the probability dilution paradox—where large covariance artificially lowers $P_c$—we evaluate Akella-Alfriend maximum $P_{c,\text{max}}$, rendering 1, 2, and 3-sigma covariance ellipses in the B-plane."* | Foster-1992 Gauss-Legendre quadrature; Mahalanobis distance; Akella $P_{c,\text{max}}$ bound; Probability Dilution Paradox. |
| **0:55 – 1:15** | Click **RF Ground Station** (`/rf`). View the **Polar Sky Plot** (Az/El radar sweep). Select **Doppler Curve Chart** and then the **Rotator Panel**. Toggle "Autonomous Tracking" in Simulator mode to watch Az/El dials slew smoothly. | *"As an EEE student, the core of my contribution is the RF Ground Station suite. For topocentric Doppler tracking, we calculate true range rate $\dot{\rho}$ including the observer station's diurnal tangential velocity $\mathbf{v}_{\text{obs}}$, which reaches $465\text{ m/s}$ at the equator. Omitting this introduces hundreds of Hertz of error at UHF. We plot the full pass Doppler S-curve, compute uplink pre-compensation, evaluate dynamic link margin along the slant range, and command dual-axis antenna rotators with cable-wrap avoidance and zenith keyhole mitigation."* | Observer diurnal velocity compensation $\mathbf{v}_{\text{obs}} = [-\omega_E y, \omega_E x, 0]^T$; uplink pre-compensation; zenith keyhole singularity handling. |
| **1:15 – 1:30** | Press `I` or click the graduation cap icon in the Navbar to open the **ISRO/HAL Technical Interview Simulator**. Show the Formula Cheat Sheet and scored questions. Conclude cleanly. | *"Finally, OrbitGuard includes an embedded firmware reference design for ESP32 and an interactive ISRO/HAL technical defense simulator covering astrodynamics, link budgets, and stepper kinematics. All math is backed by 35 unit tests and full documentation. Thank you for your time."* | ESP32 kinematic drive ($533.33\text{ steps/deg}$); verified textbook derivations; end-to-end test coverage. |

---

## 5 Pro Tips for Video Recording or Live Defense
1. **Clear Microphone & Steady Pacing**: Speak at a measured 130–140 words per minute. Do not rush through equations; speak with technical confidence.
2. **Displaying the Hotkeys**: Use the keyboard shortcut `~` right at the start to prove the renderer maintains 60 FPS without frame drops.
3. **Whiteboard Equations Ready**: If presenting live, be prepared to write on the whiteboard:
   - $\dot{\rho} = \frac{(\mathbf{r}_{\text{sat}} - \mathbf{r}_{\text{obs}}) \cdot (\mathbf{v}_{\text{sat}} - \mathbf{v}_{\text{obs}})}{\|\mathbf{r}_{\text{sat}} - \mathbf{r}_{\text{obs}}\|}$ with $\mathbf{v}_{\text{obs}} = [-\omega_E y, \omega_E x, 0]^T$
   - $\text{Steps/Deg} = \frac{200 \times 16 \times 60}{360} = 533.3333$
   - $\frac{C}{N_0} = \text{EIRP} - \text{FSPL} - L_{\text{atm}} + \left(\frac{G}{T}\right) + 228.6$
4. **Admit Screening Limitations Unprompted**: Mentioning *before the panel asks* that public TLEs lack covariance matrices and that OrbitGuard uses synthetic RTN covariance models establishes immediate scientific credibility.
5. **Demonstrate Hardware Depth**: If asked about the rotator, explain that worm gearboxes were chosen because they are self-locking against wind loads, allowing the stepper holding current to be reduced to save power.
