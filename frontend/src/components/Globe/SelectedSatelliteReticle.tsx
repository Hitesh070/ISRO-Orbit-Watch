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
import * as satelliteJs from 'satellite.js';

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

  // Find satellite index in the catalog (supporting 5-digit NORAD, aliases, and string IDs)
  const satIndex = useMemo(() => {
    if (!satellite?.norad_id || !catalog) return -1;
    const targetStr = String(satellite.norad_id).trim();
    const targetNum = Number(satellite.norad_id);
    const aliasStr = satellite.alt_alias_id ? String(satellite.alt_alias_id).trim() : null;
    const aliasNum = satellite.alt_alias_id ? Number(satellite.alt_alias_id) : null;

    return catalog.findIndex((item: any) => {
      if (!item) return false;
      const itemStr = String(item.norad_id).trim();
      const itemNum = Number(item.norad_id);
      if (itemNum === targetNum || itemStr === targetStr) return true;
      if (aliasNum !== null && (itemNum === aliasNum || itemStr === aliasStr)) return true;
      if (item.alt_alias_id && (item.alt_alias_id === targetNum || String(item.alt_alias_id) === targetStr)) return true;
      if (Array.isArray(item.alt_alias_ids)) {
        if (item.alt_alias_ids.includes(targetNum) || item.alt_alias_ids.map(String).includes(targetStr)) return true;
        if (aliasNum !== null && (item.alt_alias_ids.includes(aliasNum) || item.alt_alias_ids.map(String).includes(aliasStr!))) return true;
      }
      return false;
    });
  }, [satellite?.norad_id, satellite?.alt_alias_id, catalog]);

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
    if (!groupRef.current) return;

    let currentX = 0;
    let currentY = 0;
    let currentZ = 0;
    let hasPos = false;

    // Primary: Read from worker buffer
    if (satIndex !== -1 && posBuffer) {
      const positions = new Float32Array(posBuffer);
      const velocities = velBuffer ? new Float32Array(velBuffer) : null;
      const idx3 = satIndex * 3;

      const px = positions[idx3];
      const py = positions[idx3 + 1];
      const pz = positions[idx3 + 2];

      if (!isNaN(px) && (px !== 0 || py !== 0 || pz !== 0)) {
        const elapsedSeconds = (Date.now() - workerTickTimeMs) / 1000.0;
        const uDt = elapsedSeconds * simulationSpeed;
        const vx = velocities ? velocities[idx3] * uDt : 0;
        const vy = velocities ? velocities[idx3 + 1] * uDt : 0;
        const vz = velocities ? velocities[idx3 + 2] * uDt : 0;

        currentX = px + vx;
        currentY = py + vy;
        currentZ = pz + vz;
        hasPos = true;
      }
    }

    // Secondary / Fallback: Real-time SGP4 propagation directly from TLE lines
    if (!hasPos && satellite?.line1 && satellite?.line2) {
      try {
        const satrec = satelliteJs.twoline2satrec(satellite.line1, satellite.line2);
        if (satrec && !satrec.error) {
          const pv = satelliteJs.propagate(satrec, new Date());
          if (pv.position && typeof pv.position !== 'boolean') {
            const p = pv.position as { x: number; y: number; z: number };
            const KM_TO_SCENE = 1.0 / 6378.137;
            currentX = p.x * KM_TO_SCENE;
            currentY = p.z * KM_TO_SCENE;
            currentZ = -p.y * KM_TO_SCENE;
            hasPos = true;
          }
        }
      } catch {
        hasPos = false;
      }
    }

    // Never render at (0, 0, 0) inside Earth
    if (!hasPos || (currentX === 0 && currentY === 0 && currentZ === 0)) {
      groupRef.current.visible = false;
      if (nadirLineRef.current) nadirLineRef.current.visible = false;
      if (groundCircleRef.current) groundCircleRef.current.visible = false;
      return;
    }

    groupRef.current.visible = true;
    if (nadirLineRef.current) nadirLineRef.current.visible = true;
    if (groundCircleRef.current) groundCircleRef.current.visible = true;

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

  const displayAlt = satellite.alt_km
    ? `${Math.round(satellite.alt_km).toLocaleString()} km`
    : satellite.apogee_km
    ? `${Math.round(satellite.apogee_km).toLocaleString()} km`
    : null;

  return (
    <>
      {/* 3D Target Reticle at Satellite Position in Deep Space */}
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
        <Html position={[0, 0.14, 0]} center style={{ pointerEvents: 'none' }}>
          <div className="whitespace-nowrap px-3 py-1.5 rounded-lg bg-space-950/95 border border-cyan-400/90 shadow-2xl backdrop-blur-md flex items-center gap-2">
            <span
              className="w-2.5 h-2.5 rounded-full animate-ping"
              style={{ backgroundColor: accentColor }}
            />
            <span className="font-mono text-xs font-bold text-cyan-200">
              {satellite.name}
            </span>
            {displayAlt && (
              <span className="font-mono text-[10px] text-amber-300 font-bold px-1.5 py-0.5 rounded bg-amber-500/20 border border-amber-500/40">
                {displayAlt}
              </span>
            )}
            <span className="font-mono text-[9px] text-slate-300 px-1 py-0.2 rounded bg-slate-800/80 border border-slate-700">
              NORAD #{satellite.norad_id}
            </span>
            {satellite.regime && (
              <span className="font-mono text-[9px] text-cyan-300 font-bold px-1.5 py-0.2 rounded bg-cyan-950 border border-cyan-500/30">
                {satellite.regime}
              </span>
            )}
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
              opacity: 0.55,
            })
          )
        }
        ref={nadirLineRef}
      />

      {/* Sub-satellite ground footprint circle on Earth */}
      <mesh ref={groundCircleRef}>
        <ringGeometry args={[0.015, 0.028, 32]} />
        <meshBasicMaterial color={accentColor} side={THREE.DoubleSide} transparent opacity={0.75} />
      </mesh>
    </>
  );
};

export default SelectedSatelliteReticle;
