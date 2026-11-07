/**
 * EarthGlobe Component (v4.0 Photorealistic High-Fidelity SSA Architecture)
 * ==========================================================================
 * Renders an ultra-high-quality 3D Earth coupled with physical Greenwich Mean
 * Sidereal Time (GMST) inertial rotation in the TEME celestial frame.
 *
 * Features:
 *  - Photorealistic Day/Night Earth Shader with smooth solar terminator twilight,
 *    specular ocean sunlight reflections, and night city lights.
 *  - Atmospheric Rayleigh scattering Fresnel rim glow and independent rotating cloud deck.
 *  - Real-time Astronomical Solar Vector & physical Sun with pulsating coronal flare.
 *  - Physical Moon with cratered surface, synchronous rotation, and real solar phases.
 *  - Solar System background: Mars, Jupiter (with Great Red Spot & Galilean moons),
 *    Saturn (with tilted 3D rings), and Venus.
 *  - 14,000+ Multi-temperature Stellar Skybox with Milky Way galactic density plane.
 *  - High-performance zero-copy Web Worker propagation for 25,000+ objects at 60 FPS.
 */

import React, { useRef, useMemo, useEffect, Suspense } from 'react';
import { Canvas, useFrame, useLoader, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import * as satellite from 'satellite.js';
import { useOrbitStore } from '../../store/useOrbitStore';
import { usePropagatorWorker } from '../../hooks/usePropagatorWorker';
import PointCloud from './PointCloud';
import OrbitPath from './OrbitPath';
import SelectedSatelliteReticle from './SelectedSatelliteReticle';
import CelestialBackground from './CelestialBackground';

/**
 * Calculates current astronomical solar position in Three.js TEME coordinates.
 * (+Y is North celestial pole, +X is vernal equinox, +Z is -Y_TEME)
 */
function getSunPositionInTEME(simDate: Date = new Date()): [number, number, number] {
  const gmst = satellite.gstime(simDate);
  const utcHours = simDate.getUTCHours() + simDate.getUTCMinutes() / 60 + simDate.getUTCSeconds() / 3600;
  const subsolarLon = -(utcHours - 12) * 15 * (Math.PI / 180);

  // Solar declination approximation based on Earth's axial tilt (23.44°)
  const startOfYear = new Date(Date.UTC(simDate.getUTCFullYear(), 0, 1));
  const dayOfYear = Math.floor((simDate.getTime() - startOfYear.getTime()) / (24 * 60 * 60 * 1000));
  const declination = (-23.44 * (Math.PI / 180)) * Math.cos(((2 * Math.PI) / 365.25) * (dayOfYear + 10));

  // Sun right ascension in TEME
  const alpha = gmst + subsolarLon;
  const dist = 6.0;
  const x = Math.cos(declination) * Math.cos(alpha) * dist;
  const y = Math.sin(declination) * dist;
  const z = -Math.cos(declination) * Math.sin(alpha) * dist;
  return [x, y, z];
}

/**
 * Observer Ground Station Beacon
 * Renders an emerald beacon with vertical pin and pulsing radar concentric rings
 * on Earth's surface at (lat, lon), rotating rigidly with Earth in ECEF.
 */
interface ObserverBeaconProps {
  lat: number;
  lon: number;
  name: string;
}

const ObserverBeacon = ({ lat, lon }: ObserverBeaconProps) => {
  const phi = (lat * Math.PI) / 180;
  const lambda = (lon * Math.PI) / 180;
  const R = 1.0025; // Slightly above surface to prevent z-fighting

  const x = R * Math.cos(phi) * Math.cos(lambda);
  const y = R * Math.sin(phi);
  const z = -R * Math.cos(phi) * Math.sin(lambda);

  const ring1Ref = useRef<THREE.Mesh>(null);
  const ring2Ref = useRef<THREE.Mesh>(null);

  const orientation = useMemo(() => {
    const normal = new THREE.Vector3(x, y, z).normalize();
    const q = new THREE.Quaternion();
    q.setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal);
    return q;
  }, [x, y, z]);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    if (ring1Ref.current) {
      const p1 = (t * 1.5) % 1;
      const s1 = 1 + p1 * 2.8;
      ring1Ref.current.scale.set(s1, s1, s1);
      (ring1Ref.current.material as THREE.MeshBasicMaterial).opacity = Math.max(0, 0.9 * (1 - p1));
    }
    if (ring2Ref.current) {
      const p2 = (t * 1.5 + 0.5) % 1;
      const s2 = 1 + p2 * 2.8;
      ring2Ref.current.scale.set(s2, s2, s2);
      (ring2Ref.current.material as THREE.MeshBasicMaterial).opacity = Math.max(0, 0.9 * (1 - p2));
    }
  });

  return (
    <group position={[x, y, z]} quaternion={orientation}>
      <mesh>
        <sphereGeometry args={[0.016, 16, 16]} />
        <meshBasicMaterial color="#10b981" />
      </mesh>
      <mesh position={[0, 0, 0.03]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.0025, 0.0025, 0.06, 8]} />
        <meshBasicMaterial color="#34d399" transparent opacity={0.85} />
      </mesh>
      <mesh ref={ring1Ref} position={[0, 0, 0.001]}>
        <ringGeometry args={[0.018, 0.024, 32]} />
        <meshBasicMaterial color="#10b981" transparent opacity={0.8} side={THREE.DoubleSide} />
      </mesh>
      <mesh ref={ring2Ref} position={[0, 0, 0.001]}>
        <ringGeometry args={[0.018, 0.024, 32]} />
        <meshBasicMaterial color="#34d399" transparent opacity={0.5} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
};

/**
 * Photorealistic Custom GLSL Earth Day/Night Shader Material
 */
const EarthShaderMaterial = {
  uniforms: {
    uDayMap: { value: null },
    uNightMap: { value: null },
    uSunDirection: { value: new THREE.Vector3(1, 0, 0) },
  },
  vertexShader: `
    varying vec3 vNormal;
    varying vec2 vUv;
    varying vec3 vWorldPosition;

    void main() {
      vUv = uv;
      vNormal = normalize(normalMatrix * normal);
      vec4 worldPos = modelMatrix * vec4(position, 1.0);
      vWorldPosition = worldPos.xyz;
      gl_Position = projectionMatrix * viewMatrix * worldPos;
    }
  `,
  fragmentShader: `
    varying vec3 vNormal;
    varying vec2 vUv;
    varying vec3 vWorldPosition;

    uniform sampler2D uDayMap;
    uniform sampler2D uNightMap;
    uniform vec3 uSunDirection;

    void main() {
      vec3 normal = normalize(vNormal);
      vec3 viewDir = normalize(cameraPosition - vWorldPosition);
      vec3 sunDir = normalize(uSunDirection);

      // 1. Solar incident angle
      float NdotL = dot(normal, sunDir);

      // 2. Texture lookups
      vec4 dayColor = texture2D(uDayMap, vUv);
      vec4 nightColor = texture2D(uNightMap, vUv);

      // 3. Smooth day/night terminator transitions
      float dayFactor = smoothstep(-0.10, 0.14, NdotL);
      float nightFactor = 1.0 - smoothstep(-0.06, 0.12, NdotL);

      // 4. Sunset/Sunrise golden-crimson twilight scatter
      float twilightFactor = clamp(1.0 - abs(NdotL) * 5.0, 0.0, 1.0);
      vec3 twilightGlow = vec3(1.0, 0.44, 0.16) * twilightFactor * 0.4;

      // 5. Specular ocean sun glint
      float oceanMask = clamp((dayColor.b - dayColor.r * 0.68) * 2.5, 0.0, 1.0);
      vec3 reflectDir = reflect(-sunDir, normal);
      float specAngle = max(0.0, dot(viewDir, reflectDir));
      float specular = pow(specAngle, 28.0) * oceanMask * dayFactor * 1.5;

      // 6. Day diffuse lighting + ocean reflection
      vec3 litDay = dayColor.rgb * (max(0.05, NdotL) * 1.15 + 0.08) + vec3(1.0, 0.96, 0.88) * specular;

      // 7. Night lights shining ONLY on unlit hemisphere
      vec3 litNight = nightColor.rgb * nightFactor * 2.3;

      // 8. Composite base
      vec3 base = mix(litNight, litDay, dayFactor) + twilightGlow;

      // 9. Atmospheric Fresnel limb glow
      float fresnel = pow(1.0 - max(0.0, dot(viewDir, normal)), 3.2);
      vec3 atmosphereRim = vec3(0.18, 0.70, 0.98) * fresnel * (NdotL * 0.45 + 0.55) * 0.9;

      gl_FragColor = vec4(base + atmosphereRim, 1.0);
    }
  `,
};

/**
 * 3D Earth Globe Sphere Mesh with Real-Time GMST Inertial Rotation
 */
interface RealisticEarthMeshProps {
  sunPosition: [number, number, number];
}

const RealisticEarthMesh = ({ sunPosition }: RealisticEarthMeshProps) => {
  const earthRef = useRef<THREE.Group>(null);
  const earthMeshRef = useRef<THREE.Mesh>(null);
  const cloudsRef = useRef<THREE.Mesh>(null);

  const layers = useOrbitStore((state) => state.layers);
  const settings = useOrbitStore((state) => state.settings);
  const simulationSpeed = useOrbitStore((state) => state.simulationSpeed);
  const observerLocation = useOrbitStore((state) => state.observerLocation);
  const setSimulatedTimeMs = useOrbitStore((state) => state.setSimulatedTimeMs);

  const simTimeRef = useRef(Date.now());
  const cloudDriftRef = useRef(0);
  const lastSyncRef = useRef(0);

  // Load NASA Blue Marble daymap, night lights, and cloud layer textures
  const [dayTexture, nightTexture, cloudsTexture] = useLoader(THREE.TextureLoader, [
    './textures/earth_daymap.jpg',
    './textures/earth_nightmap.jpg',
    './textures/earth_clouds.jpg',
  ]);

  // Create custom shader material instance
  const customEarthMat = useMemo(() => {
    return new THREE.ShaderMaterial({
      uniforms: {
        uDayMap: { value: dayTexture },
        uNightMap: { value: nightTexture },
        uSunDirection: { value: new THREE.Vector3(1, 0, 0) },
      },
      vertexShader: EarthShaderMaterial.vertexShader,
      fragmentShader: EarthShaderMaterial.fragmentShader,
    });
  }, [dayTexture, nightTexture]);

  useFrame((_, delta) => {
    // Advance simulated time with user-selected simulation speed (1x = real-world physical time)
    simTimeRef.current += delta * 1000 * simulationSpeed;
    const simDate = new Date(simTimeRef.current);

    // Exact Greenwich Mean Sidereal Time in radians
    const gmst = satellite.gstime(simDate);

    // Update Earth polar axis rotation strictly by astronomical GMST
    if (earthRef.current) {
      earthRef.current.rotation.y = gmst;
    }

    // Update Sun direction uniform in Earth's rotating coordinate frame
    if (customEarthMat) {
      const sunWorld = new THREE.Vector3(...sunPosition).normalize();
      // Rotate by -gmst about Y to map world sun direction into Earth's local mesh frame
      const sunLocal = sunWorld.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), -gmst);
      customEarthMat.uniforms.uSunDirection.value.copy(sunLocal);
    }

    // Dynamic cloud layer atmospheric drift (winds blowing slightly faster than ground)
    if (cloudsRef.current && layers.clouds) {
      if (!settings?.reducedMotion) {
        cloudDriftRef.current += delta * (0.003 + 0.002 * Math.min(simulationSpeed, 10));
      }
      cloudsRef.current.rotation.y = gmst + cloudDriftRef.current;
    }

    // Throttle sync of simulated time to Zustand store (~10 Hz)
    if (Math.abs(simTimeRef.current - lastSyncRef.current) > 100) {
      lastSyncRef.current = simTimeRef.current;
      setSimulatedTimeMs(simTimeRef.current);
    }
  });

  return (
    <group ref={earthRef}>
      {/* Primary Earth Globe Sphere (Radius = 1.0) with Photorealistic Shader */}
      <mesh ref={earthMeshRef} material={customEarthMat}>
        <sphereGeometry args={[1, 64, 64]} />
      </mesh>

      {/* Realistic Rotating Cloud Layer (Radius = 1.012) */}
      {layers.clouds && (
        <mesh ref={cloudsRef}>
          <sphereGeometry args={[1.012, 64, 64]} />
          <meshStandardMaterial
            map={cloudsTexture}
            transparent
            opacity={0.42}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
          />
        </mesh>
      )}

      {/* Atmospheric Rayleigh Scattering Glow (Radius = 1.035) */}
      {layers.atmosphere && (
        <mesh>
          <sphereGeometry args={[1.035, 64, 64]} />
          <meshBasicMaterial
            color={new THREE.Color(0x38bdf8)}
            transparent
            opacity={0.16}
            side={THREE.BackSide}
            blending={THREE.AdditiveBlending}
          />
        </mesh>
      )}

      {/* Ground Station Observer Marker Beacon (rotates rigidly with Earth surface) */}
      {observerLocation && (
        <ObserverBeacon
          lat={observerLocation.lat}
          lon={observerLocation.lon}
          name={observerLocation.name}
        />
      )}
    </group>
  );
};

const EarthFallback = () => (
  <mesh>
    <sphereGeometry args={[1, 32, 32]} />
    <meshStandardMaterial color="#0e7490" roughness={0.8} />
  </mesh>
);

/**
 * Computes optimal camera distance & position based on canvas aspect ratio
 */
function getOptimalCameraPosition(width: number, height: number): [number, number, number] {
  const aspect = width / Math.max(1, height);
  let z = 2.65;
  if (aspect < 1.1) {
    z = 3.4; // Narrow or portrait
  } else if (aspect < 1.4) {
    z = 2.95; // 4:3 or small laptop
  } else if (aspect > 2.2) {
    z = 2.45; // Ultrawide 21:9
  }
  return [0, 0.35, z];
}

const GlobeScene = () => {
  const cameraAction = useOrbitStore((state) => state.cameraAction);
  const { camera, size } = useThree();
  const controlsRef = useRef<any>(null);

  // Initialize and maintain optimal responsive center on window resize
  useEffect(() => {
    if (!controlsRef.current) return;
    controlsRef.current.target.set(0, 0, 0);
  }, [size.width, size.height]);

  useEffect(() => {
    if (!cameraAction || !controlsRef.current) return;
    const controls = controlsRef.current;

    if (cameraAction.type === 'reset') {
      const [x, y, z] = getOptimalCameraPosition(size.width, size.height);
      controls.target.set(0, 0, 0);
      camera.position.set(x, y, z);
      controls.update();
    } else if (cameraAction.type === 'zoomIn') {
      const offset = camera.position.clone().sub(controls.target);
      if (offset.length() > 1.35) {
        offset.multiplyScalar(0.78);
        camera.position.copy(controls.target).add(offset);
        controls.update();
      }
    } else if (cameraAction.type === 'zoomOut') {
      const offset = camera.position.clone().sub(controls.target);
      if (offset.length() < 7.5) {
        offset.multiplyScalar(1.25);
        camera.position.copy(controls.target).add(offset);
        controls.update();
      }
    }
  }, [cameraAction, camera, size.width, size.height]);

  const catalog = useOrbitStore((state) => state.catalog);
  const selectedSatellite = useOrbitStore((state) => state.selectedSatellite);
  const selectSatellite = useOrbitStore((state) => state.selectSatellite);
  const setWorkerLatencyMs = useOrbitStore((state) => state.setWorkerLatencyMs);
  const simulationSpeed = useOrbitStore((state) => state.simulationSpeed);
  const layers = useOrbitStore((state) => state.layers);
  const simulatedTimeMs = useOrbitStore((state) => state.simulatedTimeMs);

  const sunLightRef = useRef<THREE.DirectionalLight>(null);
  const fillLightRef = useRef<THREE.PointLight>(null);

  // Current real-time astronomical Sun coordinates
  const currentSunPosition = useMemo<[number, number, number]>(() => {
    const simDate = new Date(simulatedTimeMs || Date.now());
    return getSunPositionInTEME(simDate);
  }, [simulatedTimeMs]);

  // Web Worker SGP4 Propagator Hook with ping-pong transferable buffers
  const {
    posBuffer,
    velBuffer,
    statusBuffer,
    workerTickTimeMs,
    workerMs,
    orbitPoints,
    requestOrbitPath,
  } = usePropagatorWorker(catalog);

  // Sync latency metric to store for Performance HUD
  useEffect(() => {
    setWorkerLatencyMs(workerMs);
  }, [workerMs, setWorkerLatencyMs]);

  // Request high-precision 180-point orbit path calculation when a satellite is selected
  useEffect(() => {
    if (selectedSatellite?.norad_id) {
      requestOrbitPath(selectedSatellite.norad_id);
    }
  }, [selectedSatellite?.norad_id, requestOrbitPath]);

  // Update real-time astronomical sun light in TEME
  useFrame(() => {
    const [x, y, z] = currentSunPosition;
    if (sunLightRef.current) {
      sunLightRef.current.position.set(x, y, z);
    }
    if (fillLightRef.current) {
      fillLightRef.current.position.set(-x * 0.5, -y * 0.5, -z * 0.5);
    }
  });

  return (
    <>
      {/* Deep Space Cosmic Starfield & Solar System Planets (Sun, Moon, Mars, Jupiter, Saturn, Venus) */}
      <CelestialBackground
        sunPosition={currentSunPosition}
        simulatedTimeMs={simulatedTimeMs || Date.now()}
      />

      {/* Ambient Deep Space Light */}
      <ambientLight intensity={0.28} />

      {/* Real-time Astronomical Sun Light Positioned at Subsolar Point in TEME */}
      <directionalLight ref={sunLightRef} position={[6, 0, 0]} intensity={2.6} color="#fffaf0" />

      {/* Soft celestial starlight fill */}
      <pointLight ref={fillLightRef} position={[-6, 0, 0]} intensity={0.18} color="#38bdf8" />

      {/* Photorealistic 3D Earth Globe with Day/Night Shader & Real-Time GMST Rotation */}
      <Suspense fallback={<EarthFallback />}>
        <RealisticEarthMesh sunPosition={currentSunPosition} />
      </Suspense>

      {/* Selected Satellite Glowing Orbit Path (Computed in Web Worker) */}
      {(layers.orbits || Boolean(selectedSatellite)) && orbitPoints.length > 0 && (
        <OrbitPath
          points={orbitPoints}
          color={
            selectedSatellite?.status_color === 'red'
              ? '#ef4444'
              : selectedSatellite?.status_color === 'yellow'
              ? '#f59e0b'
              : '#22d3ee'
          }
          isSelected={true}
        />
      )}

      {/* Selected Satellite 3D Target Reticle & Nadir Ground Projection */}
      {selectedSatellite && (
        <SelectedSatelliteReticle
          satellite={selectedSatellite}
          catalog={catalog}
          posBuffer={posBuffer}
          velBuffer={velBuffer}
          workerTickTimeMs={workerTickTimeMs}
          simulationSpeed={simulationSpeed}
        />
      )}

      {/* High-Performance 25,000+ Object Point Cloud (Single GPU Draw Call) */}
      {catalog.length > 0 && posBuffer && (
        <PointCloud
          catalog={catalog}
          posBuffer={posBuffer}
          velBuffer={velBuffer}
          statusBuffer={statusBuffer}
          workerTickTimeMs={workerTickTimeMs}
          simulationSpeed={simulationSpeed}
          onSelectSatellite={selectSatellite}
        />
      )}

      {/* Camera Orbit Controls (centered at Earth [0,0,0], extended zoom distance to view outer planets) */}
      <OrbitControls
        ref={controlsRef}
        enablePan={true}
        enableZoom={true}
        enableRotate={true}
        autoRotate={false}
        target={[0, 0, 0]}
        minDistance={1.32}
        maxDistance={8.5}
        rotateSpeed={0.65}
        zoomSpeed={1.1}
        dampingFactor={0.06}
      />
    </>
  );
};

export const EarthGlobe = () => {
  return (
    <div className="relative w-full h-full bg-space-950 select-none">
      <Canvas
        camera={{ position: [0, 0.35, 2.65], fov: 42 }}
        gl={{ antialias: true, alpha: false, powerPreference: 'high-performance' }}
        dpr={[1, 2]}
      >
        <GlobeScene />
      </Canvas>
    </div>
  );
};

export default EarthGlobe;
