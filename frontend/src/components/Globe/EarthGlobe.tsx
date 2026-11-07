/**
 * EarthGlobe Component (v3.2 High-Performance SSA & Point Cloud Architecture)
 * ============================================================================
 * Renders high-fidelity 3D Earth aligned with Greenwich Mean Sidereal Time (GMST)
 * in the TEME (True Equator, Mean Equinox) celestial inertial frame.
 *
 * Satellite & space debris propagation is offloaded to a dedicated Web Worker
 * (propagator.worker.ts) using ping-pong zero-copy transferable buffers.
 * Visualization of 25,000+ objects is rendered in ONE single draw call using
 * custom GLSL shaders (PointCloud.jsx) with linear velocity extrapolation at 60 FPS.
 *
 * Includes:
 * - Earth rotation dynamically connected to simulated time and time-warp (1x-60x)
 * - Ground Station observer marker with pulsing radar beacon at user's GPS/timezone coordinates
 * - Dynamic Sun illumination position matching subsolar point in TEME
 * - Atmospheric Rayleigh scattering glow & animated cloud drift
 */

import React, { useRef, useMemo, useEffect, Suspense } from 'react';
import { Canvas, useFrame, useLoader, useThree } from '@react-three/fiber';
import { OrbitControls, Stars } from '@react-three/drei';
import * as THREE from 'three';
import * as satellite from 'satellite.js';
import { useOrbitStore } from '../../store/useOrbitStore';
import { usePropagatorWorker } from '../../hooks/usePropagatorWorker';
import PointCloud from './PointCloud';
import OrbitPath from './OrbitPath';

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
  const R = 1.0025; // Placed slightly above Earth surface to prevent z-fighting

  // Cartesian coordinates on Three.js Earth sphere
  const x = R * Math.cos(phi) * Math.cos(lambda);
  const y = R * Math.sin(phi);
  const z = -R * Math.cos(phi) * Math.sin(lambda);

  const ring1Ref = useRef<THREE.Mesh>(null);
  const ring2Ref = useRef<THREE.Mesh>(null);

  // Align beacon local +Z with surface normal pointing outward
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
      const p2 = ((t * 1.5) + 0.5) % 1;
      const s2 = 1 + p2 * 2.8;
      ring2Ref.current.scale.set(s2, s2, s2);
      (ring2Ref.current.material as THREE.MeshBasicMaterial).opacity = Math.max(0, 0.9 * (1 - p2));
    }
  });

  return (
    <group position={[x, y, z]} quaternion={orientation}>
      {/* Ground Station Core Dot */}
      <mesh>
        <sphereGeometry args={[0.016, 16, 16]} />
        <meshBasicMaterial color="#10b981" />
      </mesh>

      {/* Vertical Laser Beacon Pin */}
      <mesh position={[0, 0, 0.03]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.0025, 0.0025, 0.06, 8]} />
        <meshBasicMaterial color="#34d399" transparent opacity={0.85} />
      </mesh>

      {/* Pulsing Concentric Radar Rings */}
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
 * 3D Earth Globe Sphere Mesh with GMST Inertial Rotation & Atmospheric Shaders
 */
const RealisticEarthMesh = () => {
  const earthRef = useRef<THREE.Group>(null);
  const cloudsRef = useRef<THREE.Mesh>(null);
  const layers = useOrbitStore((state) => state.layers);
  const settings = useOrbitStore((state) => state.settings);
  const simulationSpeed = useOrbitStore((state) => state.simulationSpeed);
  const observerLocation = useOrbitStore((state) => state.observerLocation);
  const setSimulatedTimeMs = useOrbitStore((state) => state.setSimulatedTimeMs);

  const simTimeRef = useRef(Date.now());
  const cloudDriftRef = useRef(0);
  const visualSpinRef = useRef(0);
  const lastSyncRef = useRef(0);

  // Load NASA Blue Marble daymap, night lights, and cloud layer textures
  const [dayTexture, nightTexture, cloudsTexture] = useLoader(THREE.TextureLoader, [
    './textures/earth_daymap.jpg',
    './textures/earth_nightmap.jpg',
    './textures/earth_clouds.jpg',
  ]);

  useFrame((_, delta) => {
    // Advance simulated time with user-selected simulation speed (1x, 5x, 15x, 60x)
    simTimeRef.current += delta * 1000 * simulationSpeed;
    const simDate = new Date(simTimeRef.current);
    const gmst = satellite.gstime(simDate);

    // Smooth perceptible axial rotation of the Earth globe itself
    if (!settings?.reducedMotion) {
      visualSpinRef.current += delta * 0.04 * Math.min(simulationSpeed, 8);
    }

    // Rotate Earth on its polar axis (+Y in Three.js TEME frame)
    if (earthRef.current) {
      earthRef.current.rotation.y = gmst + visualSpinRef.current;
    }

    // Dynamic cloud layer atmospheric drift
    if (cloudsRef.current && layers.clouds) {
      if (!settings?.reducedMotion) {
        cloudDriftRef.current += delta * (0.012 + 0.004 * Math.min(simulationSpeed, 10));
      }
      cloudsRef.current.rotation.y = gmst + visualSpinRef.current + cloudDriftRef.current;
    }

    // Throttle sync of simulated time to Zustand store (~10 Hz)
    if (Math.abs(simTimeRef.current - lastSyncRef.current) > 100) {
      lastSyncRef.current = simTimeRef.current;
      setSimulatedTimeMs(simTimeRef.current);
    }
  });

  return (
    <group ref={earthRef}>
      {/* Primary Earth Globe Sphere (Radius = 1.0) */}
      <mesh>
        <sphereGeometry args={[1, 64, 64]} />
        <meshStandardMaterial
          map={dayTexture}
          emissiveMap={nightTexture}
          emissive={new THREE.Color(0x3a2512)}
          emissiveIntensity={0.65}
          roughness={0.65}
          metalness={0.12}
        />
      </mesh>

      {/* Realistic Rotating Cloud Layer (Radius = 1.015) */}
      {layers.clouds && (
        <mesh ref={cloudsRef}>
          <sphereGeometry args={[1.015, 64, 64]} />
          <meshStandardMaterial
            map={cloudsTexture}
            transparent
            opacity={0.38}
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
            color={new THREE.Color(0x22d3ee)}
            transparent
            opacity={0.14}
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

/**
 * Fallback procedural Earth
 */
const EarthFallback = () => (
  <mesh>
    <sphereGeometry args={[1, 32, 32]} />
    <meshStandardMaterial color="#0e7490" roughness={0.8} />
  </mesh>
);

/**
 * Main Interactive Canvas Viewport Scene (Runs strictly within Canvas Context)
 */
const GlobeScene = () => {
  const cameraAction = useOrbitStore((state) => state.cameraAction);
  const { camera } = useThree();
  const controlsRef = useRef<any>(null);

  useEffect(() => {
    if (!cameraAction || !controlsRef.current) return;
    const controls = controlsRef.current;
    if (cameraAction.type === 'reset') {
      controls.target.set(0.15, 0, 0);
      camera.position.set(0.15, 0.55, 2.25);
      controls.update();
    } else if (cameraAction.type === 'zoomIn') {
      const offset = camera.position.clone().sub(controls.target);
      if (offset.length() > 1.2) {
        offset.multiplyScalar(0.78);
        camera.position.copy(controls.target).add(offset);
        controls.update();
      }
    } else if (cameraAction.type === 'zoomOut') {
      const offset = camera.position.clone().sub(controls.target);
      if (offset.length() < 11.0) {
        offset.multiplyScalar(1.28);
        camera.position.copy(controls.target).add(offset);
        controls.update();
      }
    }
  }, [cameraAction, camera]);
  const catalog = useOrbitStore((state) => state.catalog);
  const selectedSatellite = useOrbitStore((state) => state.selectedSatellite);
  const selectSatellite = useOrbitStore((state) => state.selectSatellite);
  const setWorkerLatencyMs = useOrbitStore((state) => state.setWorkerLatencyMs);
  const simulationSpeed = useOrbitStore((state) => state.simulationSpeed);
  const layers = useOrbitStore((state) => state.layers);
  const simulatedTimeMs = useOrbitStore((state) => state.simulatedTimeMs);
  const settings = useOrbitStore((state) => state.settings);

  const sunLightRef = useRef<THREE.DirectionalLight>(null);
  const fillLightRef = useRef<THREE.PointLight>(null);

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
    const simDate = new Date(simulatedTimeMs || Date.now());
    const [x, y, z] = getSunPositionInTEME(simDate);
    if (sunLightRef.current) {
      sunLightRef.current.position.set(x, y, z);
    }
    if (fillLightRef.current) {
      fillLightRef.current.position.set(-x, -y, -z);
    }
  });

  return (
    <>
      {/* Deep Space Starfield */}
      <Stars radius={100} depth={50} count={4000} factor={4} saturation={0.5} fade speed={0.8} />

      {/* Ambient Deep Space Light */}
      <ambientLight intensity={0.35} />

      {/* Real-time Astronomical Sun Light Positioned at Subsolar Point in TEME */}
      <directionalLight ref={sunLightRef} position={[6, 0, 0]} intensity={2.2} />

      {/* Soft fill light from opposite dark side */}
      <pointLight ref={fillLightRef} position={[-6, 0, 0]} intensity={0.25} color="#38bdf8" />

      {/* Realistic 3D Earth Globe Mesh (Rotates by GMST with Ground Station Beacon) */}
      <Suspense fallback={<EarthFallback />}>
        <RealisticEarthMesh />
      </Suspense>

      {/* Selected Satellite Glowing Orbit Path (Computed in Web Worker) */}
      {layers.orbits && orbitPoints.length > 0 && (
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

      {/* Camera Orbit Controls (autoRotate disabled: deep space remains steady, globe rotates on its axis) */}
      <OrbitControls
        ref={controlsRef}
        enablePan={true}
        enableZoom={true}
        enableRotate={true}
        autoRotate={false}
        target={[0.15, 0, 0]}
        minDistance={1.15}
        maxDistance={11.0}
        rotateSpeed={0.65}
        zoomSpeed={1.2}
        dampingFactor={0.06}
      />
    </>
  );
};

export const EarthGlobe = () => {
  return (
    <div className="relative w-full h-full bg-space-950 select-none">
      <Canvas
        camera={{ position: [0.15, 0.55, 2.25], fov: 42 }}
        gl={{ antialias: true, alpha: false, powerPreference: 'high-performance' }}
        dpr={[1, 2]}
      >
        <GlobeScene />
      </Canvas>
    </div>
  );
};

export default EarthGlobe;
