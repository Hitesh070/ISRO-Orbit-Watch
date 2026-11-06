/**
 * OrbitPath Component
 * Renders glowing Keplerian orbital trajectories around 3D Earth using Three.js Line.
 */

import React, { useMemo } from 'react';
import * as THREE from 'three';

/**
 * @param {{ points: Array<[number, number, number]>, color?: string, isSelected?: boolean }} props
 */
export const OrbitPath = ({ points, color = '#22d3ee', isSelected = false }) => {
  const lineObject = useMemo(() => {
    if (!points || points.length < 2) return null;

    const vectors = points.map((p) => new THREE.Vector3(p[0], p[1], p[2]));
    // Close the loop if not already closed
    if (vectors.length > 2) {
      vectors.push(vectors[0].clone());
    }

    const geometry = new THREE.BufferGeometry().setFromPoints(vectors);
    const material = new THREE.LineBasicMaterial({
      color: new THREE.Color(color),
      transparent: true,
      opacity: isSelected ? 0.95 : 0.45,
      linewidth: isSelected ? 2 : 1,
    });

    return new THREE.Line(geometry, material);
  }, [points, color, isSelected]);

  if (!lineObject) return null;

  return <primitive object={lineObject} />;
};

export default OrbitPath;
