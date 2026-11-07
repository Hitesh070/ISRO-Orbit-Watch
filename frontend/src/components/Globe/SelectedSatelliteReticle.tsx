/**
 * SelectedSatelliteReticle Component
 * ===================================
 * Renders an unmistakable 3D HUD target reticle around the currently selected satellite:
 * - Concentric pulsing selection rings facing the camera
 * - Rotating target brackets
 * - Nadir drop-line connecting satellite to its sub-satellite point on Earth
 * - Sub-satellite ground footprint circle on the globe
 * - Floating nameplate and altitude HUD chip
 */

import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';

interface SelectedSatelliteReticleProps {
  satellite: any;
  catalog: any[];
  posBuffer: ArrayBuffer | null;
  velBuffer: ArrayBuffer | null;
  workerTickTimeMs: number;
  simulationSpeed: number;
}

export const SelectedSatelliteReticle: React.FC<SelectedSatelliteReticleProps> = ({
  satellite,
  catalog,
  posBuffer,
  velBuffer,
  workerTickTimeMs,
  simulationSpeed,
}) => {
  const groupRef = useRef<THREE.Group>(null);
  const ring1Ref = useRef<THREE.Mesh>(null);
  const ring2Ref = useRef<THREE.Mesh>(null);
  const nadirLineRef = useRef<THREE.Line>(null);
  const groundCircleRef = useRef<THREE.Mesh>(null);

  // Find satellite index in the catalog
  const satIndex = useMemo(() => {
    if (!satellite?.norad_id || !catalog) return -1;
    return catalog.findIndex((item: any) => item.norad_id === satellite.norad_id);
  }, [satellite?.norad_id, catalog]);

  const lineGeo = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array([0, 0, 0, 0, 0, 0]);
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    return geo;
  }, []);

  const isDebris = satellite.object_type === 'Debris' || satellite.object_type === 'Rocket Body';
  const isISRO = satellite.is_isro || false;
  const accentColor = isISRO ? '#f59e0b' : isDebris ? '#f43f5e' : '#00f0ff';

  useFrame(({ clock, camera }) => {
    if (satIndex === -1 || !posBuffer || !groupRef.current) return;

    const positions = new Float32Array(posBuffer);
    const velocities = velBuffer ? new Float32Array(velBuffer) : null;
    const idx3 = satIndex * 3;

    const px = positions[idx3];
    const py = positions[idx3 + 1];
    const pz = positions[idx3 + 2];

    if (isNaN(px)) return;

    // Extrapolate with linear velocity
    const elapsedSeconds = (Date.now() - workerTickTimeMs) / 1000.0;
    const uDt = elapsedSeconds * simulationSpeed;

    const vx = velocities ? velocities[idx3] * uDt : 0;
    const vy = velocities ? velocities[idx3 + 1] * uDt : 0;
    const vz = velocities ? velocities[idx3 + 2] * uDt : 0;

    const currentX = px + vx;
    const currentY = py + vy;
    const currentZ = pz + vz;

    groupRef.current.position.set(currentX, currentY, currentZ);
    groupRef.current.quaternion.copy(camera.quaternion);

    const t = clock.getElapsedTime();

    // Pulse animation on reticle rings
    if (ring1Ref.current) {
      const s1 = 1.0 + 0.18 * Math.sin(t * 5.0);
      ring1Ref.current.scale.set(s1, s1, s1);
    }
    if (ring2Ref.current) {
      const s2 = 1.35 + 0.25 * Math.cos(t * 3.5);
      ring2Ref.current.scale.set(s2, s2, s2);
      ring2Ref.current.rotation.z = t * 1.5;
    }

    // Update Nadir Drop-Line down to Earth surface (R = 1.0)
    if (nadirLineRef.current) {
      const satPos = new THREE.Vector3(currentX, currentY, currentZ);
      const groundPos = satPos.clone().normalize().multiplyScalar(1.0);

      const linePosAttr = nadirLineRef.current.geometry.getAttribute('position') as THREE.BufferAttribute;
      if (linePosAttr) {
        linePosAttr.setXYZ(0, currentX, currentY, currentZ);
        linePosAttr.setXYZ(1, groundPos.x, groundPos.y, groundPos.z);
        linePosAttr.needsUpdate = true;
      }
    }

    // Update ground footprint circle
    if (groundCircleRef.current) {
      const satPos = new THREE.Vector3(currentX, currentY, currentZ);
      const groundPos = satPos.clone().normalize().multiplyScalar(1.002);
      groundCircleRef.current.position.copy(groundPos);
      groundCircleRef.current.quaternion.setFromUnitVectors(
        new THREE.Vector3(0, 0, 1),
        satPos.clone().normalize()
      );
    }
  });

  if (satIndex === -1) return null;

  return (
    <>
      {/* 3D Target Reticle at Satellite Position */}
      <group ref={groupRef}>
        {/* Core bright point */}
        <mesh>
          <sphereGeometry args={[0.022, 16, 16]} />
          <meshBasicMaterial color="#ffffff" />
        </mesh>

        {/* Primary Pulsing Target Ring */}
        <mesh ref={ring1Ref}>
          <ringGeometry args={[0.042, 0.052, 32]} />
          <meshBasicMaterial color={accentColor} side={THREE.DoubleSide} transparent opacity={0.95} />
        </mesh>

        {/* Outer Rotating Diamond Bracket */}
        <mesh ref={ring2Ref}>
          <ringGeometry args={[0.068, 0.078, 4]} />
          <meshBasicMaterial color={accentColor} side={THREE.DoubleSide} transparent opacity={0.7} />
        </mesh>

        {/* Floating 3D Nameplate Tag */}
        <Html position={[0, 0.11, 0]} center style={{ pointerEvents: 'none' }}>
          <div className="whitespace-nowrap px-2.5 py-1 rounded-lg bg-space-950/90 border border-cyan-400/80 shadow-2xl backdrop-blur-md flex items-center gap-2">
            <span
              className="w-2 h-2 rounded-full animate-ping"
              style={{ backgroundColor: accentColor }}
            />
            <span className="font-mono text-[11px] font-bold text-cyan-200">
              {satellite.name}
            </span>
            <span className="font-mono text-[10px] text-amber-300 font-semibold px-1 py-0.2 rounded bg-amber-500/10 border border-amber-500/30">
              {satellite.alt_km ? `${Math.round(satellite.alt_km)} km` : `NORAD ${satellite.norad_id}`}
            </span>
          </div>
        </Html>
      </group>

      {/* Nadir Drop-Line down to Earth */}
      <primitive
        object={
          new THREE.Line(
            lineGeo,
            new THREE.LineBasicMaterial({
              color: new THREE.Color(accentColor),
              transparent: true,
              opacity: 0.45,
            })
          )
        }
        ref={nadirLineRef}
      />

      {/* Sub-satellite ground footprint circle on Earth */}
      <mesh ref={groundCircleRef}>
        <ringGeometry args={[0.015, 0.028, 32]} />
        <meshBasicMaterial color={accentColor} side={THREE.DoubleSide} transparent opacity={0.65} />
      </mesh>
    </>
  );
};

export default SelectedSatelliteReticle;
