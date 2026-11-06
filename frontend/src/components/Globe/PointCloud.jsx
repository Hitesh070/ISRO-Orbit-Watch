/**
 * OrbitGuard High-Performance GPU Point Cloud Renderer (Phase 2)
 * ==============================================================
 * Renders 25,000+ satellites and space debris in exactly ONE draw call using
 * THREE.Points and a custom GLSL ShaderMaterial with linear velocity extrapolation.
 *
 * Coordinates are in TEME (Earth-Centered Inertial) scene units (Earth radius = 1.0).
 */

import React, { useRef, useMemo, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useOrbitStore } from '../../store/useOrbitStore';

// Custom GLSL Shaders for single-draw-call point cloud
const vertexShader = `
  attribute vec3 aVel;
  attribute vec3 aColor;
  attribute float aSize;
  attribute float aVisible;

  uniform float uDt;
  uniform float uScale;
  uniform float uTime;

  varying vec3 vColor;
  varying float vVisible;

  void main() {
    vColor = aColor;
    vVisible = aVisible;

    if (aVisible < 0.5) {
      gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
      gl_PointSize = 0.0;
      return;
    }

    // Linear velocity extrapolation: position + velocity * uDt
    vec3 extrapolatedPos = position + aVel * uDt;
    vec4 mvPosition = modelViewMatrix * vec4(extrapolatedPos, 1.0);
    gl_Position = projectionMatrix * mvPosition;

    // Size attenuation by distance from camera
    float dist = -mvPosition.z;
    gl_PointSize = (aSize * 160.0 / max(dist, 0.5)) * uScale;
    gl_PointSize = clamp(gl_PointSize, 1.5, 36.0);
  }
`;

const fragmentShader = `
  varying vec3 vColor;
  varying float vVisible;

  void main() {
    if (vVisible < 0.5) discard;

    // Anti-aliased circular particle sprite
    vec2 coord = gl_PointCoord - vec2(0.5);
    float r = length(coord);
    if (r > 0.5) discard;

    float alpha = smoothstep(0.5, 0.18, r);
    // Core specular glow
    vec3 col = mix(vColor, vec3(1.0), smoothstep(0.18, 0.0, r) * 0.4);
    gl_FragColor = vec4(col, alpha);
  }
`;

export const PointCloud = ({
  catalog,
  posBuffer,
  velBuffer,
  statusBuffer,
  workerTickTimeMs,
  simulationSpeed,
  onSelectSatellite,
}) => {
  const pointsRef = useRef();
  const materialRef = useRef();
  const { camera, size, raycaster } = useThree();

  const selectedSatellite = useOrbitStore((state) => state.selectedSatellite);
  const highlightedNoradIds = useOrbitStore((state) => state.highlightedNoradIds);
  const layers = useOrbitStore((state) => state.layers);
  const filters = useOrbitStore((state) => state.filters);

  const count = catalog.length;

  // Geometry attributes buffers
  const { geometry, colorAttr, sizeAttr, visibleAttr } = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);
    const velocities = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const sizes = new Float32Array(count);
    const visibilities = new Float32Array(count);

    for (let i = 0; i < count; i++) {
      const item = catalog[i];
      const isISRO = item.is_isro || false;
      const isDebris = item.object_type === 'Debris' || item.object_type === 'Rocket Body';

      // Colors: Saffron for ISRO, Cyan for active payload, Amber for caution, Red for debris/risk
      let r = 0.06, g = 0.72, b = 0.5; // Emerald default
      if (isISRO) {
        r = 1.0; g = 0.6; b = 0.2; // Distinct ISRO Saffron
      } else if (isDebris) {
        r = 0.95; g = 0.25; b = 0.3; // Debris rose
      } else if (item.status_color === 'red') {
        r = 0.95; g = 0.25; b = 0.25;
      } else if (item.status_color === 'yellow') {
        r = 0.96; g = 0.62; b = 0.04;
      } else {
        r = 0.0; g = 0.94; b = 1.0; // Cyan payload
      }

      colors[i * 3] = r;
      colors[i * 3 + 1] = g;
      colors[i * 3 + 2] = b;

      // Point size
      sizes[i] = isISRO ? 6.0 : isDebris ? 3.0 : 4.0;
      visibilities[i] = 1.0;
    }

    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('aVel', new THREE.BufferAttribute(velocities, 3));
    const cAttr = new THREE.BufferAttribute(colors, 3);
    const sAttr = new THREE.BufferAttribute(sizes, 1);
    const vAttr = new THREE.BufferAttribute(visibilities, 1);

    geo.setAttribute('aColor', cAttr);
    geo.setAttribute('aSize', sAttr);
    geo.setAttribute('aVisible', vAttr);

    return { geometry: geo, colorAttr: cAttr, sizeAttr: sAttr, visibleAttr: vAttr };
  }, [count, catalog]);

  // Shader Uniforms
  const uniforms = useMemo(
    () => ({
      uDt: { value: 0.0 },
      uScale: { value: Math.min(window.devicePixelRatio || 1.0, 2.0) },
      uTime: { value: 0.0 },
    }),
    []
  );

  // Update position and velocity buffers when worker delivers new transferable buffers
  useEffect(() => {
    if (!posBuffer || !geometry || count === 0) return;

    const posAttr = geometry.getAttribute('position');
    const velAttr = geometry.getAttribute('aVel');

    if (posAttr && velAttr) {
      posAttr.array.set(new Float32Array(posBuffer));
      velAttr.array.set(new Float32Array(velBuffer));

      posAttr.needsUpdate = true;
      velAttr.needsUpdate = true;
    }
  }, [posBuffer, velBuffer, geometry, count]);

  // Update visibility & filters dynamically without rebuilding geometry
  useEffect(() => {
    if (!geometry || count === 0) return;

    const vis = visibleAttr.array;
    const sizes = sizeAttr.array;
    const selNorad = selectedSatellite?.norad_id;

    for (let i = 0; i < count; i++) {
      const item = catalog[i];
      const isDebris = item.object_type === 'Debris' || item.object_type === 'Rocket Body';
      const isSatellite = !isDebris;

      let visible = 1.0;

      // Layer toggles
      if (isSatellite && !layers.satellites) visible = 0.0;
      if (isDebris && !layers.debris) visible = 0.0;

      // Filters
      if (visible > 0.5) {
        if (filters.regime !== 'ALL' && item.regime !== filters.regime) visible = 0.0;
        if (filters.objectType === 'Satellite' && isDebris) visible = 0.0;
        if (filters.objectType === 'Debris' && !isDebris) visible = 0.0;
        if (filters.riskLevel !== 'ALL' && item.risk_level !== filters.riskLevel) visible = 0.0;
        if (filters.country !== 'ALL' && !item.country?.toLowerCase().includes(filters.country.toLowerCase())) visible = 0.0;
        if (filters.search) {
          const q = filters.search.toLowerCase().trim();
          if (!item.name.toLowerCase().includes(q) && !String(item.norad_id).includes(q)) {
            visible = 0.0;
          }
        }
      }

      vis[i] = visible;

      // Highlight selected or conjunction-involved assets
      const isSelected = item.norad_id === selNorad;
      const isHighlighted = highlightedNoradIds.includes(item.norad_id);

      if (isSelected) {
        sizes[i] = 9.0;
      } else if (isHighlighted) {
        sizes[i] = 7.5;
      } else if (item.is_isro) {
        sizes[i] = 6.0;
      } else {
        sizes[i] = isDebris ? 3.0 : 4.0;
      }
    }

    visibleAttr.needsUpdate = true;
    sizeAttr.needsUpdate = true;
  }, [catalog, layers, filters, selectedSatellite, highlightedNoradIds, geometry, count, visibleAttr, sizeAttr]);

  // Frame tick: update shader uDt for seamless velocity extrapolation
  useFrame((state, delta) => {
    if (!materialRef.current) return;

    // Seconds elapsed since the last worker SGP4 update
    const elapsedSeconds = (Date.now() - workerTickTimeMs) / 1000.0;
    materialRef.current.uniforms.uDt.value = elapsedSeconds * simulationSpeed;
    materialRef.current.uniforms.uTime.value = state.clock.elapsedTime;
  });

  // Fast GPU/Screen-Space Raycasting & Nearest Neighbor Picking
  const handlePointerDown = (event) => {
    if (!geometry || count === 0) return;
    event.stopPropagation();

    // Mouse coordinates in normalized device coordinates (-1 to +1)
    const mouseX = (event.clientX / size.width) * 2 - 1;
    const mouseY = -(event.clientY / size.height) * 2 + 1;

    raycaster.setFromCamera({ x: mouseX, y: mouseY }, camera);

    const positions = geometry.getAttribute('position').array;
    const velocities = geometry.getAttribute('aVel').array;
    const visibilities = visibleAttr.array;
    const uDt = materialRef.current ? materialRef.current.uniforms.uDt.value : 0.0;

    let closestIdx = -1;
    let minDistanceSq = Infinity;

    // Test visible points against ray (approximate threshold ~ 0.08 units in 3D scene)
    const thresholdSq = 0.08 * 0.08;
    const ray = raycaster.ray;
    const p3 = new THREE.Vector3();

    for (let i = 0; i < count; i++) {
      if (visibilities[i] < 0.5) continue;

      const idx3 = i * 3;
      p3.x = positions[idx3] + velocities[idx3] * uDt;
      p3.y = positions[idx3 + 1] + velocities[idx3 + 1] * uDt;
      p3.z = positions[idx3 + 2] + velocities[idx3 + 2] * uDt;

      const distSq = ray.distanceSqToPoint(p3);
      if (distSq < thresholdSq && distSq < minDistanceSq) {
        minDistanceSq = distSq;
        closestIdx = i;
      }
    }

    if (closestIdx !== -1) {
      const selected = catalog[closestIdx];
      onSelectSatellite(selected.norad_id);
    }
  };

  return (
    <points
      ref={pointsRef}
      geometry={geometry}
      frustumCulled={false}
      onPointerDown={handlePointerDown}
    >
      <shaderMaterial
        ref={materialRef}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        uniforms={uniforms}
        transparent={true}
        depthTest={true}
        depthWrite={false}
      />
    </points>
  );
};

export default PointCloud;
