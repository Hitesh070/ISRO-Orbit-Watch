/**
 * EarthGlobe Component (v3.0 High-Performance SSA & Point Cloud Architecture)
 * ============================================================================
 * Renders high-fidelity 3D Earth aligned with Greenwich Mean Sidereal Time (GMST)
 * in the TEME (True Equator, Mean Equinox) celestial inertial frame.
 *
 * Satellite & space debris propagation is offloaded to a dedicated Web Worker
 * (propagator.worker.ts) using ping-pong zero-copy transferable buffers.
 * Visualization of 25,000+ objects is rendered in ONE single draw call using
 * custom GLSL shaders (PointCloud.jsx) with linear velocity extrapolation at 60 FPS.
 */

import React, { useRef, useMemo, useEffect, Suspense } from 'react';
import { Canvas, useFrame, useLoader } from '@react-three/fiber';
import { OrbitControls, Stars } from '@react-three/drei';
import * as THREE from 'three';
import * as satellite from 'satellite.js';
import { useOrbitStore } from '../../store/useOrbitStore';
import { usePropagatorWorker } from '../../hooks/usePropagatorWorker';
import PointCloud from './PointCloud';
import OrbitPath from './OrbitPath';

/**
 * Calculates current real-time astronomical solar position in Three.js TEME coordinates.
 * (+Y is North celestial pole, +X is vernal equinox, +Z is -Y_TEME)
 */
function getSunPositionInTEME(now = new Date()) {
  const gmst = satellite.gstime(now);
  const utcHours = now.getUTCHours() + now.getUTCMinutes() / 60 + now.getUTCSeconds() / 3600;
  const subsolarLon = -(utcHours - 12) * 15 * (Math.PI / 180);

  // Solar declination approximation based on Earth's axial tilt (23.44°)
  const startOfYear = new Date(Date.UTC(now.getUTCFullYear(), 0, 1));
  const dayOfYear = Math.floor((now.getTime() - startOfYear.getTime()) / (24 * 60 * 60 * 1000));
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
 * 3D Earth Globe Sphere Mesh with GMST Inertial Rotation & Atmospheric Shaders
 */
const RealisticEarthMesh = () => {
  const earthRef = useRef<THREE.Group>(null);
  const cloudsRef = useRef<THREE.Mesh>(null);
  const layers = useOrbitStore((state) => state.layers);

  // Load NASA Blue Marble daymap, night lights, and cloud layer textures
  const [dayTexture, nightTexture, cloudsTexture] = useLoader(THREE.TextureLoader, [
    '/textures/earth_daymap.jpg',
    '/textures/earth_nightmap.jpg',
    '/textures/earth_clouds.jpg',
  ]);

  useFrame((_, delta) => {
    const now = new Date();
    const gmst = satellite.gstime(now);

    // Rotate Earth by Greenwich Mean Sidereal Time in the TEME frame
    if (earthRef.current) {
      earthRef.current.rotation.y = gmst;
    }

    // Dynamic cloud layer atmospheric drift
    if (cloudsRef.current && layers.clouds) {
      cloudsRef.current.rotation.y = gmst + delta * 0.02;
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
  const catalog = useOrbitStore((state) => state.catalog);
  const selectedSatellite = useOrbitStore((state) => state.selectedSatellite);
  const selectSatellite = useOrbitStore((state) => state.selectSatellite);
  const setWorkerLatencyMs = useOrbitStore((state) => state.setWorkerLatencyMs);
  const simulationSpeed = useOrbitStore((state) => state.simulationSpeed);
  const layers = useOrbitStore((state) => state.layers);

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

  // Real-time Astronomical Sun Light Position in TEME
  const sunPos = useMemo(() => getSunPositionInTEME(new Date()), []);

  return (
    <>
      {/* Deep Space Starfield */}
      <Stars radius={100} depth={50} count={4000} factor={4} saturation={0.5} fade speed={0.8} />

      {/* Ambient Deep Space Light */}
      <ambientLight intensity={0.35} />

      {/* Real-time Astronomical Sun Light Positioned at Subsolar Point */}
      <directionalLight position={sunPos as [number, number, number]} intensity={2.2} />

      {/* Soft fill light from opposite dark side */}
      <pointLight
        position={[-sunPos[0], -sunPos[1], -sunPos[2]]}
        intensity={0.25}
        color="#38bdf8"
      />

      {/* Realistic 3D Earth Globe Mesh (Rotates by GMST) */}
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

      {/* Camera Orbit Controls */}
      <OrbitControls
        enablePan={true}
        enableZoom={true}
        enableRotate={true}
        minDistance={1.25}
        maxDistance={8.5}
        rotateSpeed={0.5}
        zoomSpeed={0.8}
        dampingFactor={0.08}
      />
    </>
  );
};

export const EarthGlobe = () => {
  return (
    <div className="relative w-full h-full bg-space-950 select-none">
      <Canvas
        camera={{ position: [0, 1.8, 2.8], fov: 45 }}
        gl={{ antialias: true, alpha: false, powerPreference: 'high-performance' }}
        dpr={[1, 2]}
      >
        <GlobeScene />
      </Canvas>
    </div>
  );
};

export default EarthGlobe;
