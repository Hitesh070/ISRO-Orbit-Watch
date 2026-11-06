# OrbitGuard RF & Doppler Astrodynamics Mathematical Documentation (Phase 4)

## 1. Topocentric Range Rate & Diurnal Earth Rotation Compensation

### 1.1 Vector Geometry
Let $\mathbf{r}_{\text{sat}}(t)$ and $\mathbf{v}_{\text{sat}}(t)$ denote the satellite position and velocity vectors in the True Equator, Mean Equinox (TEME) / ECI celestial inertial coordinate frame.

Let $\mathbf{r}_{\text{obs}}(t)$ be the ground station observer position in the same inertial frame:
$$\mathbf{r}_{\text{obs}} = [x_{\text{obs}}, y_{\text{obs}}, z_{\text{obs}}]^T$$

Because Earth rotates at angular rate $\omega_E \approx 7.2921150 \times 10^{-5}\text{ rad/s}$ around the celestial Z-axis ($\hat{\mathbf{k}}$), the observer possesses a non-zero tangential velocity $\mathbf{v}_{\text{obs}}$ in the inertial frame:
$$\mathbf{v}_{\text{obs}} = \boldsymbol{\omega}_E \times \mathbf{r}_{\text{obs}} = [-\omega_E y_{\text{obs}}, \; \omega_E x_{\text{obs}}, \; 0]^T$$

At the equator ($R_E \approx 6378.137\text{ km}$):
$$\|\mathbf{v}_{\text{obs}}\| = \omega_E R_E \approx 0.4651\text{ km/s} = 465.1\text{ m/s}$$

Neglecting $\mathbf{v}_{\text{obs}}$ introduces a range-rate error up to $\pm 465\text{ m/s}$, which at 437.5 MHz yields an error of $\sim \pm 680\text{ Hz}$, easily exceeding typical amateur narrowband receivers (e.g. 5 kHz channel spacing).

### 1.2 Line-of-Sight Range Rate
The topocentric slant range vector $\boldsymbol{\rho}$ and relative velocity $\mathbf{v}_{\text{rel}}$ are:
$$\boldsymbol{\rho} = \mathbf{r}_{\text{sat}} - \mathbf{r}_{\text{obs}}$$
$$\mathbf{v}_{\text{rel}} = \mathbf{v}_{\text{sat}} - \mathbf{v}_{\text{obs}}$$

The range rate $\dot{\rho} = \frac{d\|\boldsymbol{\rho}\|}{dt}$ is computed by projecting the relative velocity along the line-of-sight unit vector $\hat{\boldsymbol{\rho}}$:
$$\dot{\rho} = \frac{\boldsymbol{\rho} \cdot \mathbf{v}_{\text{rel}}}{\|\boldsymbol{\rho}\|}$$

- When approaching: $\boldsymbol{\rho} \cdot \mathbf{v}_{\text{rel}} < 0 \implies \dot{\rho} < 0$
- At TCA (Time of Closest Approach): $\boldsymbol{\rho} \perp \mathbf{v}_{\text{rel}} \implies \dot{\rho} = 0$
- When receding: $\boldsymbol{\rho} \cdot \mathbf{v}_{\text{rel}} > 0 \implies \dot{\rho} > 0$

---

## 2. Doppler Shift & Rate Equations

### 2.1 Downlink Doppler Shift
For a source transmitting at nominal carrier frequency $f_0$, the received frequency $f_{\text{rx}}$ at the ground station is:
$$f_{\text{rx}} = f_0 \left(1 - \frac{\dot{\rho}}{c}\right)$$
$$\Delta f = f_{\text{rx}} - f_0 = -f_0 \frac{\dot{\rho}}{c}$$
where $c = 299,792.458\text{ km/s}$.

The relativistic second-order Doppler correction is of order $(v/c)^2 \approx (7.5 / 300000)^2 \approx 6.25 \times 10^{-10}$, representing $< 0.3\text{ Hz}$ at UHF and is neglected in screening-grade operations.

### 2.2 Uplink Pre-Compensation
To ensure that a satellite's transponder or command receiver receives exactly $f_0$, the ground station must pre-compensate its transmit frequency $f_{\text{tx}}$:
$$f_{\text{tx}} = \frac{f_0}{1 - \frac{\dot{\rho}}{c}} \approx f_0 \left(1 + \frac{\dot{\rho}}{c}\right)$$

### 2.3 Doppler Rate
The Doppler rate $\frac{d(\Delta f)}{dt}$ (in Hz/s) determines the required Phase-Locked Loop (PLL) loop filter bandwidth:
$$\frac{d(\Delta f)}{dt} = -\frac{f_0}{c} \ddot{\rho}$$

Computed numerically via central difference:
$$\frac{d(\Delta f)}{dt} \approx \frac{\Delta f(t + \Delta t) - \Delta f(t - \Delta t)}{2 \Delta t}$$

---

## 3. Radio Frequency Link Budget

### 3.1 Free Space Path Loss (FSPL)
Derived from the Friis transmission equation:
$$\text{FSPL} = \left(\frac{4\pi d}{\lambda}\right)^2 = \left(\frac{4\pi d f}{c}\right)^2$$
In logarithmic engineering units:
$$\text{FSPL (dB)} = 20\log_{10}(d_{\text{km}}) + 20\log_{10}(f_{\text{MHz}}) + 32.44$$

### 3.2 Parabolic Dish Antenna Gain
For an aperture with physical diameter $D$ (meters), illumination efficiency $\eta$ (typically $0.55$), and wavelength $\lambda = c/f$:
$$G = \eta \left(\frac{\pi D}{\lambda}\right)^2$$
$$G_{\text{dBi}} = 10\log_{10}\left(\eta \left(\frac{\pi D f}{c}\right)^2\right)$$

### 3.3 Beamwidth and Pointing Loss
The Half-Power Beamwidth (HPBW) in degrees is approximated by:
$$\theta_{3\text{dB}} \approx 70 \frac{\lambda}{D} = 70 \frac{c / f}{D}$$
The off-axis pointing loss $L_{\text{point}}$ (dB) for pointing alignment error $\theta_{\text{err}}$:
$$L_{\text{point}} \approx 12 \left(\frac{\theta_{\text{err}}}{\theta_{3\text{dB}}}\right)^2$$

### 3.4 Downlink Link Equation
$$\text{EIRP (dBW)} = P_t (\text{dBW}) + G_t (\text{dBi}) - L_t (\text{dB})$$
$$P_{\text{rx}} (\text{dBW}) = \text{EIRP} - \text{FSPL} - L_{\text{atm}} - L_{\text{point}} - L_{\text{pol}} - L_{\text{feeder}} + G_r$$

$$\frac{C}{N_0} (\text{dB-Hz}) = \text{EIRP} - (\text{FSPL} + L_{\text{atm}} + L_{\text{point}} + L_{\text{pol}}) + \left(\frac{G}{T}\right) - 10\log_{10}(k_B)$$
where Boltzmann's constant $k_B = 1.380649 \times 10^{-23}\text{ J/K} \implies -10\log_{10}(k_B) = +228.6\text{ dBW/(Hz}\cdot\text{K)}$.

Energy per bit to noise power spectral density:
$$\frac{E_b}{N_0} (\text{dB}) = \frac{C}{N_0} - 10\log_{10}(R_b)$$
where $R_b$ is the digital channel bit rate in bits per second (bps).

### 3.5 Link Margin Verdict
$$\text{Margin (dB)} = \frac{E_b}{N_0} - \left(\frac{E_b}{N_0}\right)_{\text{required}} - L_{\text{impl}}$$
- **CLOSED**: $\text{Margin} \ge +3.0\text{ dB}$ (Mission operational standard)
- **MARGINAL**: $0.0\text{ dB} \le \text{Margin} < +3.0\text{ dB}$ (Vulnerable to fading / weather)
- **FAILED**: $\text{Margin} < 0.0\text{ dB}$ (Bit Error Rate above threshold; receiver loss of frame sync)

---

## 4. Worked Textbook Example

### Parameters: UHF CubeSat Downlink
- **Frequency**: $f = 437.5\text{ MHz}$ ($\lambda = 0.685\text{ m}$)
- **Slant Range at TCA**: $d = 850\text{ km}$
- **Tx Power**: $P_t = 1.0\text{ W} = 0.0\text{ dBW}$
- **Tx Antenna Gain**: $G_t = 2.15\text{ dBi}$ (Quarter-wave monopole)
- **Tx Cable Loss**: $L_t = 0.5\text{ dB}$
- **Satellite EIRP**: $0.0 + 2.15 - 0.5 = +1.65\text{ dBW}$
- **FSPL**: $20\log_{10}(850) + 20\log_{10}(437.5) + 32.44 = 58.59 + 52.82 + 32.44 = 143.85\text{ dB}$
- **Ground Antenna**: 10-element Yagi, $G_r = 14.5\text{ dBi}$
- **System Noise Temp**: $T_{\text{sys}} = 250\text{ K} \implies 10\log_{10}(250) = 23.98\text{ dB-K}$
- **Ground G/T**: $14.5 - 23.98 = -9.48\text{ dB/K}$
- **Atmospheric + Pointing + Pol Losses**: $L_{\text{other}} = 0.5 + 0.3 + 0.5 = 1.3\text{ dB}$
- **Total Path Loss**: $143.85 + 1.30 = 145.15\text{ dB}$
- **Received C/N0**:
  $$\frac{C}{N_0} = +1.65 - 145.15 - 9.48 + 228.60 = 75.62\text{ dB-Hz}$$
- **Data Rate**: $R_b = 9600\text{ bps} \implies 10\log_{10}(9600) = 39.82\text{ dB}$
- **Received Eb/N0**:
  $$\frac{E_b}{N_0} = 75.62 - 39.82 = 35.80\text{ dB}$$
- **Required Eb/N0** (GFSK at $\text{BER} = 10^{-5}$): $9.6\text{ dB}$
- **Implementation Loss**: $1.5\text{ dB}$
- **Link Margin**:
  $$\text{Margin} = 35.80 - 9.60 - 1.50 = +24.70\text{ dB} \quad \text{[LINK CLOSED: Robust]}$$
