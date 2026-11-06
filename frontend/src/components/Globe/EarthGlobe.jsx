/**
 * EarthGlobe Component
 * Renders high-fidelity 3D Earth using NASA Blue Marble textures, city lights nightmap,
 * cloud layer rotation, atmospheric Rayleigh scattering glow, and orbital entity layers.
 */

import React, { useRef, useMemo, Suspense } from 'react';
import { Canvas, useFrame, useLoader } from '@react-three/fiber';
import { OrbitControls, Stars } from '@react-three/drei';
import * as THREE from 'three';
import { useOrbitStore } from '../../store/useOrbitStore';
import SatelliteMarker from './SatelliteMarker';
import OrbitPath from './OrbitPath';

/**
 * 3D Earth Core Sphere Mesh
 */
const EarthMesh = () => {
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
    // Gentle axial rotation of clouds
    if (cloudsRef.current && layers.clouds) {
      cloudsRef.current.rotation.y += delta * 0.015;
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
          emissive={new THREE.Color(0x332211)}
          emissiveIntensity={0.65}
          roughness={0.7}
          metalness={0.1}
        />
      </mesh>

      {/* Cloud Layer Sphere (Radius = 1.012) */}
      {layers.clouds && (
        <mesh ref={cloudsRef}>
          <sphereGeometry args={[1.012, 64, 64]} />
          <meshStandardMaterial
            map={cloudsTexture}
            transparent
            opacity={0.35}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
          />
        </mesh>
      )}

      {/* Atmospheric Glow Rim Shell (Radius = 1.035) */}
      {layers.atmosphere && (
        <mesh>
          <sphereGeometry args={[1.035, 64, 64]} />
          <meshBasicMaterial
            color={new THREE.Color(0x38bdf8)}
            transparent
            opacity={0.12}
            side={THREE.BackSide}
            blending={THREE.AdditiveBlending}
          />
        </mesh>
      )}
    </group>
  );
};

/**
 * Fallback procedural Earth when textures are loading
 */
const EarthFallback = () => (
  <mesh>
    <sphereGeometry args={[1, 32, 32]} />
    <meshStandardMaterial color="#0e7490" roughness={0.8} />
  </mesh>
);

/**
 * Main Earth Globe Canvas Container
 */
export const EarthGlobe = () => {
  const satellites = useOrbitStore((state) => state.satellites);
  const debris = useOrbitStore((state) => state.debris);
  const selectedSatellite = useOrbitStore((state) => state.selectedSatellite);
  const selectedSatelliteDetail = useOrbitStore((state) => state.selectedSatelliteDetail);
  const highlightedNoradIds = useOrbitStore((state) => state.highlightedNoradIds);
  const layers = useOrbitStore((state) => state.layers);
  const filters = useOrbitStore((state) => state.filters);
  const selectSatellite = useOrbitStore((state) => state.selectSatellite);

  // Apply search and regime filters
  const filteredSatellites = useMemo(() => {
    return satellites.filter((sat) => {
      if (filters.regime !== 'ALL' && sat.regime !== filters.regime) return false;
      if (filters.country !== 'ALL' && !sat.country?.toLowerCase().includes(filters.country.toLowerCase())) return false;
      if (filters.riskLevel !== 'ALL' && sat.risk_level !== filters.riskLevel) return false;
      if (filters.search) {
        const q = filters.search.toLowerCase().trim();
        const matchesName = sat.name.toLowerCase().includes(q);
        const matchesId = String(sat.norad_id).includes(q);
        if (!matchesName && !matchesId) return false;
      }
      return true;
    });
  }, [satellites, filters]);

  const filteredDebris = useMemo(() => {
    if (!layers.debris) return [];
    if (filters.objectType === 'Satellite') return [];
    return debris.filter((deb) => {
      if (filters.regime !== 'ALL' && deb.regime !== filters.regime) return false;
      if (filters.search) {
        const q = filters.search.toLowerCase().trim();
        return deb.name.toLowerCase().includes(q) || String(deb.norad_id).includes(q);
      }
      return true;
    });
  }, [debris, layers.debris, filters]);

  // Selected orbit path points from detailed telemetry
  const activeOrbitPath = selectedSatelliteDetail?.orbit_path || [];

  return (
    <div className="relative w-full h-full bg-space-950 select-none">
      <Canvas
        camera={{ position: [0, 1.8, 2.8], fov: 45 }}
        gl={{ antialias: true, alpha: false, powerPreference: 'high-performance' }}
      >
        {/* Deep Space Starfield */}
        <Stars radius={100} depth={50} count={3500} factor={4} saturation={0.5} fade speed={1} />

        {/* Lighting Setup: Directional Sun + Ambient Spacefill */}
        <ambientLight intensity={0.4} />
        <directionalLight position={[5, 3, 5]} intensity={1.8} castShadow={false} />
        <pointLight position={[-8, -4, -6]} intensity={0.3} color="#38bdf8" />

        {/* 3D Earth Globe with Textures */}
        <Suspense fallback={<EarthFallback />}>
          <EarthMesh />
        </Suspense>

        {/* Orbit Path of Selected Satellite */}
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

        {/* Active Satellite Markers */}
        {layers.satellites &&
          filteredSatellites.map((sat) => (
            <SatelliteMarker
              key={sat.norad_id}
              item={sat}
              isSelected={selectedSatellite?.norad_id === sat.norad_id}
              isHighlighted={highlightedNoradIds.includes(sat.norad_id)}
              onSelect={selectSatellite}
            />
          ))}

        {/* Space Debris Markers */}
        {layers.debris &&
          filteredDebris.map((deb) => (
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
      </Canvas>
    </div>
  );
};

export default EarthGlobe;
