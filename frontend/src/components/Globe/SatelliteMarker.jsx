/**
 * SatelliteMarker Component
 * Interactive 3D spacecraft / space debris marker with dynamic risk-based color-coding,
 * pulsing halos, and click-to-inspect interactivity.
 * Fixed: eliminated full-screen covering modal bug on click.
 */

import React, { useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';

/**
 * @param {{
 *   item: Object,
 *   isSelected: boolean,
 *   isHighlighted: boolean,
 *   onSelect: (noradId: number) => void
 * }} props
 */
export const SatelliteMarker = ({ item, isSelected, isHighlighted, onSelect }) => {
  const meshRef = useRef();
  const ringRef = useRef();
  const [hovered, setHovered] = useState(false);

  const isDebris = item.object_type === 'Debris' || item.object_type === 'Rocket Body';

  // Determine color based on risk status
  let markerColor = '#10b981'; // Green = Safe
  if (isDebris) {
    markerColor = '#f97316'; // Amber/Orange = Debris
  } else if (item.status_color === 'red' || item.risk_level === 'HIGH RISK') {
    markerColor = '#ef4444'; // Red = High Risk
  } else if (item.status_color === 'yellow' || item.risk_level === 'CAUTION') {
    markerColor = '#eab308'; // Yellow = Caution
  }

  if (isHighlighted) {
    markerColor = '#ec4899'; // Hot pink pulse for active conjunction pair
  }

  const [x, y, z] = item.cartesian || [0, 1.1, 0];
  const size = isSelected ? 0.032 : isHighlighted ? 0.028 : isDebris ? 0.015 : 0.022;

  // Gentle pulse animation for selected or highlighted items
  useFrame(({ clock }) => {
    if (ringRef.current && (isSelected || isHighlighted)) {
      const t = clock.getElapsedTime() * 3.5;
      const s = 1.0 + Math.sin(t) * 0.35;
      ringRef.current.scale.set(s, s, s);
    }
  });

  return (
    <group position={[x, y, z]}>
      {/* Interactive Dot Mesh */}
      <mesh
        ref={meshRef}
        onClick={(e) => {
          e.stopPropagation();
          onSelect(item.norad_id);
        }}
        onPointerOver={(e) => {
          e.stopPropagation();
          setHovered(true);
          document.body.style.cursor = 'pointer';
        }}
        onPointerOut={() => {
          setHovered(false);
          document.body.style.cursor = 'auto';
        }}
      >
        <sphereGeometry args={[size, 16, 16]} />
        <meshBasicMaterial color={markerColor} />
      </mesh>

      {/* Pulsing Selection Ring / Halo on the 3D globe */}
      {(isSelected || isHighlighted) && (
        <mesh ref={ringRef}>
          <ringGeometry args={[size * 1.4, size * 2.2, 32]} />
          <meshBasicMaterial
            color={isHighlighted ? '#f43f5e' : markerColor}
            side={THREE.DoubleSide}
            transparent
            opacity={0.85}
          />
        </mesh>
      )}

      {/* Compact, fixed-size hover chip only when hovering (NEVER covers screen on click) */}
      {hovered && !isSelected && (
        <Html position={[0, size * 1.8, 0]} center style={{ pointerEvents: 'none' }}>
          <div className="whitespace-nowrap rounded-md bg-space-950/90 px-2 py-0.5 text-[10px] font-mono text-cyan-300 shadow-lg border border-cyan-500/50 backdrop-blur-sm flex items-center gap-1.5 animate-in fade-in duration-150">
            <span
              className="w-1.5 h-1.5 rounded-full inline-block"
              style={{ backgroundColor: markerColor }}
            />
            <span className="font-bold">{item.name}</span>
            <span className="text-slate-400">({item.alt_km?.toFixed(0)} km)</span>
          </div>
        </Html>
      )}
    </group>
  );
};

export default SatelliteMarker;
