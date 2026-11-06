# Conjunction Assessment & Collision Probability ($P_c$)

**Module:** `scripts/pipeline/conjunction_engine.py`  
**Astrodynamic Standard:** Foster (1992) 2-D Integral & Akella-Alfriend (2000) $P_{c,\text{max}}$  
**Reference Frames:** TEME / ECI (Inertial), RTN (Radial-Transverse-Normal), Encounter Plane $(\hat{x}_e, \hat{y}_e)$  

---

## 1. Physical Formulation & The Encounter Plane

In orbital mechanics, a conjunction event occurs when two space objects (e.g., an operational satellite and a space debris fragment) approach each other at close range. Let $\mathbf{r}_1(t), \mathbf{v}_1(t)$ and $\mathbf{r}_2(t), \mathbf{v}_2(t)$ denote the positions and velocities of the two bodies in the Earth-Centered Inertial (ECI / TEME) frame at the **Time of Closest Approach (TCA)** $t_{\text{TCA}}$.

We define the relative state vectors:
$$\mathbf{r}_{\text{rel}} = \mathbf{r}_1(t_{\text{TCA}}) - \mathbf{r}_2(t_{\text{TCA}})$$
$$\mathbf{v}_{\text{rel}} = \mathbf{v}_1(t_{\text{TCA}}) - \mathbf{v}_2(t_{\text{TCA}})$$

### 1.1 Encounter Plane Orthonormal Basis
The encounter plane (also known as the **B-plane** or collision plane) is defined as the plane passing through object 1 and perpendicular to the relative velocity vector $\mathbf{v}_{\text{rel}}$.

1. Define the unit normal along the relative velocity:
   $$\hat{z}_e = \frac{\mathbf{v}_{\text{rel}}}{\|\mathbf{v}_{\text{rel}}\|}$$

2. Construct an arbitrary non-collinear unit vector $\mathbf{a}$:
   $$\mathbf{a} = \begin{cases} [1, 0, 0]^T & \text{if } |\hat{z}_{e,x}| < 0.9 \\ [0, 1, 0]^T & \text{otherwise} \end{cases}$$

3. Compute the orthogonal encounter basis vectors:
   $$\hat{x}_e = \frac{\mathbf{a} \times \hat{z}_e}{\|\mathbf{a} \times \hat{z}_e\|}$$
   $$\hat{y}_e = \hat{z}_e \times \hat{x}_e$$

4. The $2 \times 3$ projection matrix $\mathbf{B}$ is:
   $$\mathbf{B} = \begin{bmatrix} \hat{x}_e^T \\ \hat{y}_e^T \end{bmatrix} \in \mathbb{R}^{2 \times 3}$$

### 1.2 Projection of Relative Miss Vector and Covariance
The 2-D miss vector $\mathbf{m} = [x_m, y_m]^T$ on the encounter plane is:
$$\mathbf{m} = \mathbf{B} \, \mathbf{r}_{\text{rel}}$$
The miss distance is $\|\mathbf{m}\| = \sqrt{x_m^2 + y_m^2}$.

Assuming the positional errors of the two bodies are uncorrelated zero-mean Gaussians with $3 \times 3$ ECI covariance matrices $C_1$ and $C_2$, the combined positional uncertainty on the encounter plane is:
$$C_{2d} = \mathbf{B} \, (C_1 + C_2) \, \mathbf{B}^T \in \mathbb{R}^{2 \times 2}$$

---

## 2. Collision Probability ($P_c$)

### 2.1 The Hard-Body Sphere Model
The two objects are modeled as spheres of physical radii $R_1$ and $R_2$. Under the hard-body sphere assumption, a physical collision occurs if the relative position vector enters the combined sphere of radius:
$$R = \text{HBR} = R_1 + R_2$$
Projected onto the 2-D encounter plane, the collision region is a circular disk of radius $R$ centered at the origin:
$$\mathcal{D} = \{\mathbf{p} \in \mathbb{R}^2 : \|\mathbf{p}\| \le R\}$$

### 2.2 Foster-1992 2-D Probability Integral
The probability of collision $P_c$ is the integral of the bivariate Gaussian probability density function (PDF) over the hard-body disk $\mathcal{D}$:
$$P_c = \frac{1}{2\pi \sqrt{\det C_{2d}}} \iint_{\mathcal{D}} \exp\left(-\frac{1}{2} (\mathbf{p} - \mathbf{m})^T C_{2d}^{-1} (\mathbf{p} - \mathbf{m})\right) d\mathbf{p}$$

Transforming to polar coordinates $\mathbf{p}(r, \theta) = \begin{pmatrix} r \cos\theta \\ r \sin\theta \end{pmatrix}$ with $r \in [0, R]$ and $\theta \in [0, 2\pi)$:
$$P_c = \frac{1}{2\pi \sqrt{\det C_{2d}}} \int_0^R \int_0^{2\pi} \exp\left(-\frac{1}{2} (\mathbf{p}(r, \theta) - \mathbf{m})^T C_{2d}^{-1} (\mathbf{p}(r, \theta) - \mathbf{m})\right) r \, dr \, d\theta$$

#### Numerical Quadrature
OrbitGuard evaluates this integral using **Gauss-Legendre quadrature** with $n_r = 64$ points along the radial dimension and a uniform trapezoidal grid with $n_\theta = 128$ points along the angular dimension:
- Radial nodes $x_i \in [-1, 1]$ and weights $w_i$ are mapped to $r_i = \frac{R}{2}(x_i + 1)$ with weights $\tilde{w}_i = \frac{R}{2} w_i$.
- Trapezoidal integration along $\theta$ converges exponentially due to the periodic $2\pi$ domain.

---

## 3. Asymptotic Bounds & Maximum Collision Probability

### 3.1 Closed-Form Small-HBR Approximation
When the hard-body radius is significantly smaller than the position uncertainty ($R \ll \sqrt{\lambda_{\min}(C_{2d})}$), the Gaussian PDF is approximately constant over the disk $\mathcal{D}$. The integral simplifies to the PDF value at $\mathbf{m}$ multiplied by the disk area $\pi R^2$:
$$P_{c,\text{small}} \approx \frac{R^2}{2 \sqrt{\det C_{2d}}} \exp\left(-\frac{1}{2} d_M^2\right)$$
where $d_M^2 = \mathbf{m}^T C_{2d}^{-1} \mathbf{m}$ is the squared **Mahalanobis distance**.

OrbitGuard verifies in `tests/test_conjunction_math.py` that $P_{c,\text{small}}$ agrees with $P_{c,\text{Foster}}$ within $< 0.01\%$ when $R/\sigma < 0.01$.

### 3.2 Akella-Alfriend Maximum Probability ($P_{c,\text{max}}$)
In operational SSA, covariance matrices from TLEs or uncertain tracking sensors may have accurate orientation but uncalibrated overall scale. Akella & Alfriend (2000) introduced a conservative upper bound by scaling the covariance matrix by a positive scalar factor $k > 0$:
$$C_{2d}(k) = k \cdot C_{2d}$$
$$P_{c,\text{max}} = \max_{k \in [10^{-2}, 10^2]} P_c(\mathbf{m}, k C_{2d}, R)$$

- When $k \to 0$ (infinitely small uncertainty), $P_c \to 0$ if $\|\mathbf{m}\| > R$.
- When $k \to \infty$ (infinitely large uncertainty), the probability density dilutes and $P_c \to 0$.
- A unique maximum $P_{c,\text{max}}$ occurs at an intermediate scale factor $k^*$. OrbitGuard scans a log-spaced grid of 160 points to locate $k^*$ and report $P_{c,\text{max}}$.

---

## 4. Synthetic RTN Covariance Model

Because publicly distributed TLE / GP ephemerides do not include covariance matrices, OrbitGuard generates **screening-grade synthetic covariance** in the satellite's local **Radial-Transverse-Normal (RTN)** frame:
- $\hat{\mathbf{r}} = \frac{\mathbf{r}}{\|\mathbf{r}\|}$ (Radial, outward from Earth)
- $\hat{\mathbf{n}} = \frac{\mathbf{r} \times \mathbf{v}}{\|\mathbf{r} \times \mathbf{v}\|}$ (Normal / Cross-Track, along orbital angular momentum)
- $\hat{\mathbf{t}} = \hat{\mathbf{n}} \times \hat{\mathbf{r}}$ (Transverse / In-Track, along flight path for circular orbits)

### 4.1 Secular Error Growth with TLE Age
Atmospheric drag and solar radiation pressure uncertainties cause in-track positional errors to grow much faster than radial and normal errors:
$$\sigma_R(t) = \sigma_{R,0} + \alpha_R \cdot \Delta t_{\text{age}}$$
$$\sigma_T(t) = \sigma_{T,0} + \alpha_T \cdot (\Delta t_{\text{age}})^{1.25}$$
$$\sigma_N(t) = \sigma_{N,0} + \alpha_N \cdot \Delta t_{\text{age}}$$

Default parameters from `config/covariance.yaml`:
- $\sigma_{R,0} = 100\text{ m}$, $\alpha_R = 50\text{ m/day}$
- $\sigma_{T,0} = 800\text{ m}$, $\alpha_T = 750\text{ m/day}^{1.25}$
- $\sigma_{N,0} = 150\text{ m}$, $\alpha_N = 60\text{ m/day}$

### 4.2 Rotation to ECI Reference Frame
The diagonal RTN covariance matrix $C_{\text{rtn}} = \text{diag}(\sigma_R^2, \sigma_T^2, \sigma_N^2)$ is rotated into TEME / ECI:
$$\mathbf{R} = \begin{bmatrix} \hat{\mathbf{r}} & \hat{\mathbf{t}} & \hat{\mathbf{n}} \end{bmatrix} \in \mathbb{R}^{3 \times 3}$$
$$C_{\text{eci}} = \mathbf{R} \, C_{\text{rtn}} \, \mathbf{R}^T$$

`tests/test_conjunction_math.py` verifies that $\mathbf{R} \mathbf{R}^T = \mathbf{I}$ and $\det(\mathbf{R}) = +1.0$.

---

## 5. Physical Assumptions & Failure Regimes

The Foster-1992 planar model relies on four core assumptions:
1. **Short Encounter Duration:** The encounter duration $\tau = \frac{2R}{\|\mathbf{v}_{\text{rel}}\|}$ is on the order of milliseconds to seconds. The trajectory during the encounter is assumed rectilinear with constant relative velocity.
2. **Stationary Uncertainty:** The covariance matrices $C_1, C_2$ remain constant over the encounter window $\tau$.
3. **Linear Uncorrelated Errors:** Errors in the positions of the two bodies are zero-mean Gaussian and statistically independent ($E[\delta \mathbf{r}_1 \delta \mathbf{r}_2^T] = \mathbf{0}$).
4. **Spherical Hard Bodies:** Orientation and attitude dynamics are neglected.

### Where the Model Breaks (Failure Regimes)
- **Low Relative Speed ($v_{\text{rel}} < 100\text{ m/s}$):** In co-orbital encounters (e.g. satellites in the same constellation shell, co-located geostationary satellites, or orbital rendezvous operations), the encounter duration spans tens of minutes. Curvilinear relative orbital dynamics (Clohessy-Wiltshire / Hill equations) dominate, invalidating the planar rectilinear assumption. OrbitGuard flags these events as **`CO-ORBITAL`**.
- **Long Encounters / Resonance:** When two objects remain close over multiple orbital revolutions, full numerical Monte Carlo propagation or torus-integral methods must be employed.
