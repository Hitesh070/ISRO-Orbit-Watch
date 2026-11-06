/**
 * EarthGlobe Component (v2.0 High-Fidelity & Real-Time SGP4 Engine)
 * Renders high-quality 3D Earth with astronomical Sun-aligned day/night terminator,
 * dynamic cloud layer drift, atmospheric Rayleigh scattering glow,
 * and continuous sub-second SGP4 orbital propagation loop on every frame.
 */

import React, { useRef, useMemo, useState, Suspense } from 'react';
import { Canvas, useFrame, useLoader } from '@react-three/fiber';
import { OrbitControls, Stars } from '@react-three/drei';
import * as THREE from 'three';
import { useOrbitStore } from '../../store/useOrbitStore';
import { propagateCatalogRealTime, computeOrbitPathClient } from '../../utils/sgp4Engine';
import SatelliteMarker from './SatelliteMarker';
import OrbitPath from './OrbitPath';

/**
 * Calculates current real-time solar sub-point direction in Three.js coordinates
 * based on current UTC date and time.
 */
function getSunDirection(now = new Date()) {
  const utcHours = now.getUTCHours() + now.getUTCMinutes() / 60 + now.getUTCSeconds() / 3600;
  // Subsolar longitude in degrees
  const sunLon = -(utcHours - 12) * 15;
  const sunLonRad = (sunLon * Math.PI) / 180;

  // Approximate solar declination for Earth's axial tilt (23.44°)
  const startOfYear = new Date(Date.UTC(now.getUTCFullYear(), 0, 1));
  const dayOfYear = Math.floor((now - startOfYear) / (24 * 60 * 60 * 1000));
  const declinationRad = (-23.44 * (Math.PI / 180)) * Math.cos(((2 * Math.PI) / 365.25) * (dayOfYear + 10));

  const x = Math.cos(declinationRad) * Math.sin(sunLonRad) * 6;
  const y = Math.sin(declinationRad) * 6;
  const z = Math.cos(declinationRad) * Math.cos(sunLonRad) * 6;
  return [x, y, z];
}

/**
 * 3D Earth Core Sphere Mesh with Day/Night Lighting and Realistic Clouds
 */
const RealisticEarthMesh = () => {
  const earthRef = useRef();
  const cloudsRef = useRef();
  const layers = useOrbitStore((state) => state.layers);

  // Load NASA Blue Marble daymap, night lights, and cloud layer textures
  const [dayTexture, nightTexture, cloudsTexture] = useLoader(THREE.TextureLoader, [
    '/textures/earth_daymap.jpg',
    '/textures/earth_nightmap.jpg',
    '/textures/earth_clouds.jpg',
  ]);

  useFrame((_, delta) => {
    // Realistic cloud layer atmospheric drift (faster than Earth rotation)
    if (cloudsRef.current && layers.clouds) {
      cloudsRef.current.rotation.y += delta * 0.02;
    }
  });

  return (
    <group>
      {/* Primary Earth Globe Sphere (Radius = 1.0) */}
      <mesh ref={earthRef}>
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
 * Main Interactive Canvas Viewport Scene (Runs within Canvas Context)
 */
const GlobeScene = () => {
  const selectedSatellite = useOrbitStore((state) => state.selectedSatellite);
  const highlightedNoradIds = useOrbitStore((state) => state.highlightedNoradIds);
  const layers = useOrbitStore((state) => state.layers);
  const filters = useOrbitStore((state) => state.filters);
  const simulationSpeed = useOrbitStore((state) => state.simulationSpeed);
  const selectSatellite = useOrbitStore((state) => state.selectSatellite);

  // Live real-time SGP4 positions updated every single frame inside Canvas
  const [liveObjects, setLiveObjects] = useState({ activeSats: [], debrisList: [] });
  const simulatedTimeRef = useRef(Date.now());

  // Sun direction based on current time
  const sunPos = useMemo(() => getSunDirection(new Date()), []);

  // Compute live continuous positions every frame inside Canvas
  useFrame((_, delta) => {
    // Advance simulated time based on speed multiplier (1x, 5x, 15x, 60x)
    simulatedTimeRef.current += delta * 1000 * simulationSpeed;
    const currentSimDate = new Date(simulatedTimeRef.current);

    const propagated = propagateCatalogRealTime(currentSimDate);
    setLiveObjects(propagated);
  });

  // Filter real-time active satellites
  const visibleSatellites = useMemo(() => {
    if (!layers.satellites) return [];
    return liveObjects.activeSats.filter((sat) => {
      if (filters.regime !== 'ALL' && sat.regime !== filters.regime) return false;
      if (filters.country !== 'ALL' && !sat.country?.toLowerCase().includes(filters.country.toLowerCase())) return false;
      if (filters.riskLevel !== 'ALL' && sat.risk_level !== filters.riskLevel) return false;
      if (filters.search) {
        const q = filters.search.toLowerCase().trim();
        return sat.name.toLowerCase().includes(q) || String(sat.norad_id).includes(q);
      }
      return true;
    });
  }, [liveObjects.activeSats, layers.satellites, filters]);

  // Filter real-time debris
  const visibleDebris = useMemo(() => {
    if (!layers.debris) return [];
    if (filters.objectType === 'Satellite') return [];
    return liveObjects.debrisList.filter((deb) => {
      if (filters.regime !== 'ALL' && deb.regime !== filters.regime) return false;
      if (filters.search) {
        const q = filters.search.toLowerCase().trim();
        return deb.name.toLowerCase().includes(q) || String(deb.norad_id).includes(q);
      }
      return true;
    });
  }, [liveObjects.debrisList, layers.debris, filters]);

  // Orbit path of currently selected satellite (sampled client-side or from API)
  const activeOrbitPath = useMemo(() => {
    if (!selectedSatellite?.norad_id) return [];
    return computeOrbitPathClient(selectedSatellite.norad_id, 180);
  }, [selectedSatellite?.norad_id]);

  return (
    <>
      {/* Deep Space Starfield */}
      <Stars radius={100} depth={50} count={4000} factor={4} saturation={0.5} fade speed={0.8} />

      {/* Ambient Deep Space Light */}
      <ambientLight intensity={0.35} />

      {/* Real-time Astronomical Sun Light Positioned at Subsolar Point */}
      <directionalLight position={sunPos} intensity={2.2} />

      {/* Soft fill light from opposite dark side */}
      <pointLight position={[-sunPos[0], -sunPos[1], -sunPos[2]]} intensity={0.25} color="#38bdf8" />

      {/* Realistic 3D Earth Globe Mesh */}
      <Suspense fallback={<EarthFallback />}>
        <RealisticEarthMesh />
      </Suspense>

      {/* Selected Satellite Glowing Orbit Path */}
      {layers.orbits && activeOrbitPath.length > 0 && (
        <OrbitPath
          points={activeOrbitPath}
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

      {/* Real-Time Active Satellite Markers (Continuously Moving in Space) */}
      {visibleSatellites.map((sat) => (
        <SatelliteMarker
          key={sat.norad_id}
          item={sat}
          isSelected={selectedSatellite?.norad_id === sat.norad_id}
          isHighlighted={highlightedNoradIds.includes(sat.norad_id)}
          onSelect={selectSatellite}
        />
      ))}

      {/* Real-Time Space Debris Markers */}
      {visibleDebris.map((deb) => (
        <SatelliteMarker
          key={deb.norad_id}
          item={deb}
          isSelected={selectedSatellite?.norad_id === deb.norad_id}
          isHighlighted={highlightedNoradIds.includes(deb.norad_id)}
          onSelect={selectSatellite}
        />
      ))}

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
      >
        <GlobeScene />
      </Canvas>
    </div>
  );
};

export default EarthGlobe;
