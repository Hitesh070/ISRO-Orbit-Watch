/**
 * SatelliteMarker Component
 * Interactive 3D spacecraft / space debris marker with dynamic risk-based color-coding,
 * pulsing halos, and click-to-inspect interactivity.
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
  const size = isSelected ? 0.035 : isHighlighted ? 0.03 : isDebris ? 0.016 : 0.024;

  // Gentle pulse animation for selected or highlighted items
  useFrame(({ clock }) => {
    if (ringRef.current && (isSelected || isHighlighted)) {
      const t = clock.getElapsedTime() * 3;
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

      {/* Pulsing Selection Ring */}
      {(isSelected || isHighlighted || hovered) && (
        <mesh ref={ringRef}>
          <ringGeometry args={[size * 1.5, size * 2.1, 32]} />
          <meshBasicMaterial
            color={isHighlighted ? '#f43f5e' : markerColor}
            side={THREE.DoubleSide}
            transparent
            opacity={0.8}
          />
        </mesh>
      )}

      {/* Tooltip on Hover or Selection */}
      {(hovered || isSelected) && (
        <Html distanceFactor={12} position={[0, size * 2.2, 0]} center>
          <div className="pointer-events-none whitespace-nowrap rounded-md bg-space-900/95 px-2.5 py-1 text-xs font-mono text-cyan-300 shadow-xl border border-cyan-500/40 backdrop-blur-md">
            <div className="font-bold flex items-center gap-1.5">
              <span
                className="w-2 h-2 rounded-full inline-block"
                style={{ backgroundColor: markerColor }}
              />
              {item.name}
            </div>
            <div className="text-[10px] text-slate-300">
              NORAD: {item.norad_id} | Alt: {item.alt_km} km | Vel: {item.velocity_km_s} km/s
            </div>
            {item.risk_score !== undefined && !isDebris && (
              <div className="text-[10px] text-amber-400 font-semibold">
                Risk: {item.risk_score} ({item.risk_level})
              </div>
            )}
          </div>
        </Html>
      )}
    </group>
  );
};

export default SatelliteMarker;
