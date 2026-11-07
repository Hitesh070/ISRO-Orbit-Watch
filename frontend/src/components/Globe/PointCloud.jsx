/**
 * OrbitGuard High-Performance GPU Point Cloud Renderer (Phase 2 & 3)
 * ===================================================================
 * Renders 25,000+ satellites and space debris in exactly ONE draw call using
 * THREE.Points and a custom GLSL ShaderMaterial with linear velocity extrapolation.
 *
 * Implements direct screen-space pixel picking on the WebGL canvas so clicking
 * any satellite or debris dot immediately triggers selection and displays its dossier.
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

    // Crisp distance-attenuated point size (camera dist ~ 2.0 - 5.0)
    float dist = max(-mvPosition.z, 0.8);
    gl_PointSize = (aSize * 26.0 / dist) * uScale;
    gl_PointSize = clamp(gl_PointSize, 2.0, 20.0);
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

    float alpha = smoothstep(0.5, 0.15, r);
    // Core specular glow
    vec3 col = mix(vColor, vec3(1.0), smoothstep(0.18, 0.0, r) * 0.45);
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
  const { gl, camera } = useThree();

  const selectedSatellite = useOrbitStore((state) => state.selectedSatellite);
  const highlightedNoradIds = useOrbitStore((state) => state.highlightedNoradIds);
  const layers = useOrbitStore((state) => state.layers);
  const filters = useOrbitStore((state) => state.filters);
  const favourites = useOrbitStore((state) => state.favourites);

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

      // Colors: Saffron for ISRO (#FF9933), Cyan for active payloads, Rose for debris
      let r = 0.0, g = 0.94, b = 1.0;
      if (isISRO) {
        r = 1.0; g = 0.6; b = 0.2; // ISRO Saffron
      } else if (isDebris) {
        r = 0.96; g = 0.35; b = 0.42; // Debris rose
      } else if (item.status_color === 'red') {
        r = 0.95; g = 0.25; b = 0.25;
      } else if (item.status_color === 'yellow') {
        r = 0.96; g = 0.62; b = 0.04;
      } else {
        r = 0.0; g = 0.94; b = 1.0;
      }

      colors[i * 3] = r;
      colors[i * 3 + 1] = g;
      colors[i * 3 + 2] = b;

      // Sharp, balanced point size
      sizes[i] = isISRO ? 4.5 : isDebris ? 1.8 : 2.8;
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

    // Initial dummy bounding sphere
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0, 0), 10.0);

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

      // Keep bounding sphere valid
      geometry.computeBoundingSphere();
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
        if (filters.favouritesOnly && !favourites.includes(item.norad_id)) visible = 0.0;
        if (filters.regime !== 'ALL' && item.regime !== filters.regime) visible = 0.0;
        if (filters.objectType === 'Satellite' && isDebris) visible = 0.0;
        if (filters.objectType === 'Debris' && !isDebris) visible = 0.0;
        if (filters.riskLevel !== 'ALL' && item.risk_level !== filters.riskLevel) visible = 0.0;
        // User requirement: "only indian satellites, but all debris"
        if (filters.indianSatsOnly) {
          if (isSatellite && !item.is_isro && !item.country?.toLowerCase().includes('india')) {
            visible = 0.0;
          }
          // All debris pieces remain completely visible!
        } else if (filters.country !== 'ALL') {
          if (isSatellite && !item.country?.toLowerCase().includes(filters.country.toLowerCase())) {
            visible = 0.0;
          }
        }
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
        sizes[i] = 7.5;
      } else if (isHighlighted) {
        sizes[i] = 6.0;
      } else if (item.is_isro) {
        sizes[i] = 4.5;
      } else {
        sizes[i] = isDebris ? 1.8 : 2.8;
      }
    }

    visibleAttr.needsUpdate = true;
    sizeAttr.needsUpdate = true;
  }, [catalog, layers, filters, selectedSatellite, highlightedNoradIds, geometry, count, visibleAttr, sizeAttr]);

  // Frame tick: update shader uDt for seamless velocity extrapolation
  useFrame((state) => {
    if (!materialRef.current) return;

    // Seconds elapsed since the last worker SGP4 update
    const elapsedSeconds = (Date.now() - workerTickTimeMs) / 1000.0;
    materialRef.current.uniforms.uDt.value = elapsedSeconds * simulationSpeed;
    materialRef.current.uniforms.uTime.value = state.clock.elapsedTime;
  });

  // Direct High-Reliability Screen-Space 2D Pixel Picking
  useEffect(() => {
    const canvas = gl.domElement;
    if (!canvas) return;

    const findNearestSatelliteAtScreenPos = (clientX, clientY, maxPixelDist = 28.0) => {
      if (!geometry || count === 0) return -1;

      const rect = canvas.getBoundingClientRect();
      const clickX = clientX - rect.left;
      const clickY = clientY - rect.top;

      const positions = geometry.getAttribute('position').array;
      const velocities = geometry.getAttribute('aVel').array;
      const visibilities = visibleAttr.array;
      const uDt = materialRef.current ? materialRef.current.uniforms.uDt.value : 0.0;

      let closestIdx = -1;
      let minDistance = maxPixelDist;
      const v3 = new THREE.Vector3();

      for (let i = 0; i < count; i++) {
        if (visibilities[i] < 0.5) continue;

        const idx3 = i * 3;
        v3.x = positions[idx3] + velocities[idx3] * uDt;
        v3.y = positions[idx3 + 1] + velocities[idx3 + 1] * uDt;
        v3.z = positions[idx3 + 2] + velocities[idx3 + 2] * uDt;

        // Project 3D coordinate to NDC (-1 to +1)
        v3.project(camera);

        // If behind camera, skip
        if (v3.z > 1.0) continue;

        // Convert NDC to screen pixels
        const screenX = ((v3.x + 1) / 2) * rect.width;
        const screenY = ((-v3.y + 1) / 2) * rect.height;

        const dx = clickX - screenX;
        const dy = clickY - screenY;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < minDistance) {
          minDistance = dist;
          closestIdx = i;
        }
      }

      return closestIdx;
    };

    let downX = 0;
    let downY = 0;
    let downTime = 0;

    const handlePointerDown = (event) => {
      downX = event.clientX;
      downY = event.clientY;
      downTime = Date.now();
    };

    const handlePointerUp = (event) => {
      const moveDist = Math.hypot(event.clientX - downX, event.clientY - downY);
      const elapsed = Date.now() - downTime;

      // Only trigger satellite selection if user tapped/clicked without dragging (< 8px movement, < 600ms)
      if (moveDist < 8.0 && elapsed < 600) {
        const idx = findNearestSatelliteAtScreenPos(event.clientX, event.clientY, 34.0);
        if (idx !== -1) {
          const selected = catalog[idx];
          console.log('[OrbitGuard] Selected satellite on 3D globe:', selected.name, selected.norad_id);
          onSelectSatellite(selected.norad_id);
        }
      }
    };

    const handlePointerMove = (event) => {
      const idx = findNearestSatelliteAtScreenPos(event.clientX, event.clientY, 26.0);
      canvas.style.cursor = idx !== -1 ? 'pointer' : 'default';
    };

    canvas.addEventListener('pointerdown', handlePointerDown);
    canvas.addEventListener('pointerup', handlePointerUp);
    canvas.addEventListener('pointermove', handlePointerMove);

    return () => {
      canvas.removeEventListener('pointerdown', handlePointerDown);
      canvas.removeEventListener('pointerup', handlePointerUp);
      canvas.removeEventListener('pointermove', handlePointerMove);
      canvas.style.cursor = 'default';
    };
  }, [gl, camera, geometry, count, catalog, onSelectSatellite, visibleAttr]);

  return (
    <points
      ref={pointsRef}
      geometry={geometry}
      frustumCulled={false}
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
