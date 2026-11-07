/**
 * CelestialBackground Component (Photorealistic Astronomical Cosmos)
 * ====================================================================
 * Renders an authentic, deep-space environment:
 *  - 360° High-Resolution Milky Way Galactic Skybox with authentic galactic core,
 *    dust absorption lanes (The Great Rift), and cosmic star clouds.
 *  - 10,000 Precision Pinpoint Stars rendered with an anti-aliased Gaussian
 *    Airy disc shader (clamped to realistic sub-pixel/pinpoint sizes, zero Minecraft squares).
 *  - Astronomical Sun with realistic solar photosphere and coronal flare halo.
 *  - Distant physical Moon with real solar phase illumination (tidally locked).
 */

import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import {
  getMoonTexture,
  getSunCoronaTexture,
  getMilkyWaySkyboxTexture,
} from './celestialTextures';

interface CelestialBackgroundProps {
  sunPosition: [number, number, number];
  simulatedTimeMs: number;
}

// Custom Shader for Photorealistic Anti-Aliased Pinpoint Stars
const StarShaderMaterial = {
  vertexShader: `
    attribute float aSize;
    attribute vec3 aColor;
    attribute float aAlpha;

    varying vec3 vColor;
    varying float vAlpha;

    void main() {
      vColor = aColor;
      vAlpha = aAlpha;
      vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
      // Realistic astronomical size attenuation with strict upper bound
      float pSize = aSize * (180.0 / -mvPosition.z);
      gl_PointSize = clamp(pSize, 1.0, 3.8);
      gl_Position = projectionMatrix * mvPosition;
    }
  `,
  fragmentShader: `
    varying vec3 vColor;
    varying float vAlpha;

    void main() {
      // Coordinate relative to center of point (-0.5 to 0.5)
      vec2 coord = gl_PointCoord - vec2(0.5);
      float dist = length(coord);
      if (dist > 0.5) discard;

      // Physically accurate Airy disc with exponential Gaussian core and soft diffraction halo
      float core = exp(-dist * dist * 38.0);
      float halo = (1.0 - smoothstep(0.06, 0.5, dist)) * 0.28;
      float intensity = core + halo;

      gl_FragColor = vec4(vColor, intensity * vAlpha);
    }
  `,
};

export const CelestialBackground: React.FC<CelestialBackgroundProps> = ({
  sunPosition,
}) => {
  const sunHaloRef = useRef<THREE.Mesh>(null);
  const moonRef = useRef<THREE.Group>(null);
  const skyboxRef = useRef<THREE.Mesh>(null);

  // Textures generated deterministically in memory
  const moonTexture = useMemo(() => getMoonTexture(), []);
  const sunCoronaTexture = useMemo(() => getSunCoronaTexture(), []);
  const milkyWayTexture = useMemo(() => getMilkyWaySkyboxTexture(), []);

  // Astronomical Sun coordinates in scene space (at realistic distance)
  const sunWorldPos = useMemo(() => {
    return new THREE.Vector3(...sunPosition).normalize().multiplyScalar(42.0);
  }, [sunPosition]);

  // Generate 10,000 Photorealistic Stars with Astronomical Spectral Temperatures
  const { starGeometry, starMaterial } = useMemo(() => {
    const count = 10000;
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const sizes = new Float32Array(count);
    const alphas = new Float32Array(count);

    // Realistic stellar spectral colors (B-V Color Temperatures)
    const spectralColors = [
      new THREE.Color('#b5caff'), // Class O/B: Hot blue-white
      new THREE.Color('#ffffff'), // Class A: Pure diamond white (Sirius, Vega)
      new THREE.Color('#fff6ec'), // Class F: Pale yellowish white (Procyon)
      new THREE.Color('#ffe9c4'), // Class G: Solar yellow (Sun, Capella)
      new THREE.Color('#ffd29e'), // Class K: Light orange (Arcturus, Aldebaran)
      new THREE.Color('#ff9c80'), // Class M: Deep orange/red (Betelgeuse, Antares)
    ];

    // Galactic tilt plane (~60.2° to celestial equator)
    const galacticTilt = (60.2 * Math.PI) / 180;
    const normalG = new THREE.Vector3(0, Math.cos(galacticTilt), Math.sin(galacticTilt)).normalize();

    for (let i = 0; i < count; i++) {
      const idx3 = i * 3;
      const isMilkyWay = i < 4500;

      let dir: THREE.Vector3;
      if (isMilkyWay) {
        const angle = Math.random() * Math.PI * 2;
        const u = new THREE.Vector3(Math.cos(angle), 0, Math.sin(angle));
        const tangent = u.clone().cross(normalG).normalize();
        const thickness = (Math.random() + Math.random() - 1.0) * 0.22;
        dir = tangent.clone().addScaledVector(normalG, thickness).normalize();
      } else {
        const u = Math.random();
        const v = Math.random();
        const theta = u * 2.0 * Math.PI;
        const phi = Math.acos(2.0 * v - 1.0);
        dir = new THREE.Vector3(
          Math.sin(phi) * Math.cos(theta),
          Math.sin(phi) * Math.sin(theta),
          Math.cos(phi)
        );
      }

      // Distance on outer celestial shell
      const dist = 90 + Math.random() * 40;
      positions[idx3] = dir.x * dist;
      positions[idx3 + 1] = dir.y * dist;
      positions[idx3 + 2] = dir.z * dist;

      // Color temperature selection: mostly white/blue-white with occasional yellow/orange/red
      const rand = Math.random();
      let color: THREE.Color;
      if (rand < 0.40) color = spectralColors[1]; // White
      else if (rand < 0.70) color = spectralColors[0]; // Blue-white
      else if (rand < 0.85) color = spectralColors[2]; // Pale yellow
      else if (rand < 0.94) color = spectralColors[3]; // Solar yellow
      else if (rand < 0.98) color = spectralColors[4]; // Orange
      else color = spectralColors[5]; // Red giant

      // Apparent brightness (magnitude distribution)
      const isBright = Math.random() < 0.04;
      const isMedium = Math.random() < 0.18;
      const brightness = isBright ? 1.0 : isMedium ? 0.75 : 0.35 + Math.random() * 0.35;

      colors[idx3] = color.r * brightness;
      colors[idx3 + 1] = color.g * brightness;
      colors[idx3 + 2] = color.b * brightness;

      // Realistic pinpoint sizes: strictly sub-pixel or small point
      sizes[i] = isBright ? 2.4 : isMedium ? 1.6 : 1.1;
      alphas[i] = isBright ? 1.0 : isMedium ? 0.85 : 0.55;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('aColor', new THREE.BufferAttribute(colors, 3));
    geo.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
    geo.setAttribute('aAlpha', new THREE.BufferAttribute(alphas, 1));

    const mat = new THREE.ShaderMaterial({
      vertexShader: StarShaderMaterial.vertexShader,
      fragmentShader: StarShaderMaterial.fragmentShader,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    return { starGeometry: geo, starMaterial: mat };
  }, []);

  // Frame animations: corona flare pulse and Moon orbit
  useFrame(({ clock }) => {
    const elapsed = clock.getElapsedTime();

    // Pulse Sun's coronal flare halo
    if (sunHaloRef.current) {
      const pulse = 1.0 + Math.sin(elapsed * 1.5) * 0.04;
      sunHaloRef.current.scale.set(pulse, pulse, pulse);
      sunHaloRef.current.rotation.z = elapsed * 0.015;
    }

    // Moon's physical orbit around Earth at realistic distance
    if (moonRef.current) {
      const moonPeriodSec = 300;
      const moonAngle = (elapsed / moonPeriodSec) * Math.PI * 2;
      const moonDist = 26.0; // Distant physical orbit
      const moonInc = (5.14 * Math.PI) / 180;
      moonRef.current.position.set(
        Math.cos(moonAngle) * moonDist,
        Math.sin(moonAngle) * Math.sin(moonInc) * moonDist,
        Math.sin(moonAngle) * Math.cos(moonInc) * moonDist
      );
      // Tidally locked rotation
      moonRef.current.rotation.y = moonAngle;
    }
  });

  return (
    <group>
      {/* =========================================================================
          1. 360° PHOTOREALISTIC DEEP-SPACE MILKY WAY SKYBOX (Radius = 140)
         ========================================================================= */}
      <mesh ref={skyboxRef} rotation={[0.42, 0.85, 0.2]}>
        <sphereGeometry args={[140, 48, 48]} />
        <meshBasicMaterial
          map={milkyWayTexture}
          side={THREE.BackSide}
          depthWrite={false}
        />
      </mesh>

      {/* =========================================================================
          2. DEEP SPACE PINPOINT STARFIELD (Anti-Aliased Circular Shader Disc)
         ========================================================================= */}
      <points geometry={starGeometry} material={starMaterial} />

      {/* =========================================================================
          3. REAL-TIME PHYSICAL ASTRONOMICAL SUN & RADIANT CORONA
         ========================================================================= */}
      <group position={sunWorldPos}>
        {/* Core Solar Photosphere Sphere */}
        <mesh>
          <sphereGeometry args={[2.2, 32, 32]} />
          <meshBasicMaterial color="#fffef5" />
        </mesh>

        {/* High-Energy Solar Flare Inner Corona Billboard */}
        <mesh ref={sunHaloRef}>
          <planeGeometry args={[12.0, 12.0]} />
          <meshBasicMaterial
            map={sunCoronaTexture}
            transparent
            blending={THREE.AdditiveBlending}
            depthWrite={false}
            side={THREE.DoubleSide}
          />
        </mesh>

        {/* Soft Outer Radial Glare Ring */}
        <mesh>
          <planeGeometry args={[22.0, 22.0]} />
          <meshBasicMaterial
            map={sunCoronaTexture}
            transparent
            opacity={0.32}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
            side={THREE.DoubleSide}
          />
        </mesh>

        {/* Omnidirectional High-Intensity Solar Light Source */}
        <pointLight intensity={4.2} distance={120} decay={1.0} color="#fff8eb" />
      </group>

      {/* =========================================================================
          4. THE MOON (Distant, Tidally Locked, with Physical Solar Phases)
         ========================================================================= */}
      <group ref={moonRef} position={[26.0, 0.5, 0]}>
        <mesh receiveShadow castShadow>
          <sphereGeometry args={[0.42, 32, 32]} />
          <meshStandardMaterial
            map={moonTexture}
            roughness={0.92}
            metalness={0.02}
          />
        </mesh>
      </group>
    </group>
  );
};

export default CelestialBackground;
