/**
 * CelestialBackground Component (Phase 3 Realistic Solar System & Cosmos)
 * =========================================================================
 * Renders a physically grounded celestial environment around Earth:
 *  - Real-time Astronomical Sun with blazing photosphere and corona flare halo
 *  - The Moon with cratered basaltic texture and real solar phase illumination
 *  - Outer solar system planets: Mars, Jupiter (with Great Red Spot & Galilean moons),
 *    Saturn (with majestic tilted 3D rings), and Venus
 *  - 14,000+ Multi-temperature Stellar Skybox with Milky Way galactic density plane
 */

import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import {
  getMoonTexture,
  getJupiterTexture,
  getSaturnTexture,
  getSaturnRingsTexture,
  getMarsTexture,
  getSunCoronaTexture,
} from './celestialTextures';

interface CelestialBackgroundProps {
  sunPosition: [number, number, number];
  simulatedTimeMs: number;
}

export const CelestialBackground: React.FC<CelestialBackgroundProps> = ({
  sunPosition,
  simulatedTimeMs,
}) => {
  const sunHaloRef = useRef<THREE.Mesh>(null);
  const moonRef = useRef<THREE.Group>(null);
  const jupiterRef = useRef<THREE.Group>(null);
  const saturnRef = useRef<THREE.Group>(null);
  const marsRef = useRef<THREE.Group>(null);

  // Textures generated deterministically in memory
  const moonTexture = useMemo(() => getMoonTexture(), []);
  const jupiterTexture = useMemo(() => getJupiterTexture(), []);
  const saturnTexture = useMemo(() => getSaturnTexture(), []);
  const saturnRingsTexture = useMemo(() => getSaturnRingsTexture(), []);
  const marsTexture = useMemo(() => getMarsTexture(), []);
  const sunCoronaTexture = useMemo(() => getSunCoronaTexture(), []);

  // Astronomical Sun coordinates in scene space
  const sunWorldPos = useMemo(() => {
    const v = new THREE.Vector3(...sunPosition).normalize().multiplyScalar(22.0);
    return v;
  }, [sunPosition]);

  // Generate 14,000 Stars with Milky Way Galactic Concentration & Spectral Colors
  const { starPositions, starColors, starSizes } = useMemo(() => {
    const count = 14000;
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const sizes = new Float32Array(count);

    // Astronomical star spectral color palette (B-V Color Temperatures)
    const spectralColors = [
      new THREE.Color('#9bb0ff'), // Class O/B: Blue-White High Temperature
      new THREE.Color('#ffffff'), // Class A: Pure White
      new THREE.Color('#fff4e8'), // Class F: Yellow-White
      new THREE.Color('#ffddaa'), // Class G: Solar Golden Yellow
      new THREE.Color('#ffb56c'), // Class K: Orange Giant
      new THREE.Color('#ff7878'), // Class M: Crimson Red Dwarf
      new THREE.Color('#88e1ff'), // Electric Cyan
    ];

    // Galactic plane normal vector (inclined at ~60.2° to celestial equator)
    const galacticTilt = (60.2 * Math.PI) / 180;
    const normalG = new THREE.Vector3(0, Math.cos(galacticTilt), Math.sin(galacticTilt)).normalize();

    for (let i = 0; i < count; i++) {
      const idx3 = i * 3;
      const isMilkyWay = i < 5500; // First 5,500 form the dense Milky Way band

      let dir: THREE.Vector3;
      if (isMilkyWay) {
        // Sample closely along the galactic disk plane
        const angle = Math.random() * Math.PI * 2;
        const u = new THREE.Vector3(Math.cos(angle), 0, Math.sin(angle));
        // Project onto galactic plane
        const tangent = u.clone().cross(normalG).normalize();
        const thickness = (Math.random() - 0.5) * 0.28;
        dir = tangent.clone().addScaledVector(normalG, thickness).normalize();
      } else {
        // Uniform spherical distribution across deep space
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

      const dist = 75 + Math.random() * 55;
      positions[idx3] = dir.x * dist;
      positions[idx3 + 1] = dir.y * dist;
      positions[idx3 + 2] = dir.z * dist;

      // Color temperature selection
      const color = spectralColors[Math.floor(Math.random() * spectralColors.length)];
      const brightness = isMilkyWay ? 0.7 + Math.random() * 0.3 : 0.4 + Math.random() * 0.6;
      colors[idx3] = color.r * brightness;
      colors[idx3 + 1] = color.g * brightness;
      colors[idx3 + 2] = color.b * brightness;

      // Star apparent size
      sizes[i] = Math.random() < 0.03 ? 2.8 : Math.random() < 0.15 ? 1.8 : 1.0;
    }

    return { starPositions: positions, starColors: colors, starSizes: sizes };
  }, []);

  // Frame animations: solar corona flare pulse and planetary orbits
  useFrame(({ clock }) => {
    const elapsed = clock.getElapsedTime();

    // Pulse Sun's coronal flare halo
    if (sunHaloRef.current) {
      const pulse = 1.0 + Math.sin(elapsed * 1.2) * 0.05;
      sunHaloRef.current.scale.set(pulse, pulse, pulse);
      sunHaloRef.current.rotation.z = elapsed * 0.02;
    }

    // Moon's physical orbit around Earth (~27.3-day synodic cycle)
    if (moonRef.current) {
      const moonPeriodSec = 240; // Visual orbital period
      const moonAngle = (elapsed / moonPeriodSec) * Math.PI * 2;
      const moonDist = 13.5;
      const moonInc = (5.14 * Math.PI) / 180; // 5.14° inclination
      moonRef.current.position.set(
        Math.cos(moonAngle) * moonDist,
        Math.sin(moonAngle) * Math.sin(moonInc) * moonDist,
        Math.sin(moonAngle) * Math.cos(moonInc) * moonDist
      );
      // Synchronous rotation (tidally locked, rotating with orbit)
      moonRef.current.rotation.y = moonAngle;
    }

    // Slow planetary axial rotations
    if (jupiterRef.current) jupiterRef.current.rotation.y = elapsed * 0.03;
    if (saturnRef.current) saturnRef.current.rotation.y = elapsed * 0.025;
    if (marsRef.current) marsRef.current.rotation.y = elapsed * 0.02;
  });

  return (
    <group>
      {/* =========================================================================
          1. REAL-TIME PHYSICAL SUN & EXPONENTIAL CORONA RADIATION
         ========================================================================= */}
      <group position={sunWorldPos}>
        {/* Core Solar Photosphere Sphere */}
        <mesh>
          <sphereGeometry args={[1.65, 32, 32]} />
          <meshBasicMaterial color="#fffbe6" />
        </mesh>

        {/* High-Energy Solar Flare Inner Corona Billboard */}
        <mesh ref={sunHaloRef}>
          <planeGeometry args={[9.5, 9.5]} />
          <meshBasicMaterial
            map={sunCoronaTexture}
            transparent
            blending={THREE.AdditiveBlending}
            depthWrite={false}
            side={THREE.DoubleSide}
          />
        </mesh>

        {/* Outward Radial Lens Flare Ring */}
        <mesh>
          <planeGeometry args={[16.0, 16.0]} />
          <meshBasicMaterial
            map={sunCoronaTexture}
            transparent
            opacity={0.35}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
            side={THREE.DoubleSide}
          />
        </mesh>

        {/* Omnidirectional Solar Light source */}
        <pointLight intensity={3.5} distance={70} decay={1.2} color="#fff6e5" />
      </group>

      {/* =========================================================================
          2. THE MOON (Tidally Locked with Real Solar Phase Illumination)
         ========================================================================= */}
      <group ref={moonRef} position={[13.5, 0.4, 0]}>
        <mesh receiveShadow castShadow>
          <sphereGeometry args={[0.32, 32, 32]} />
          <meshStandardMaterial
            map={moonTexture}
            roughness={0.92}
            metalness={0.05}
          />
        </mesh>

        {/* Delicate lunar twilight limb */}
        <mesh>
          <sphereGeometry args={[0.325, 32, 32]} />
          <meshBasicMaterial
            color="#94a3b8"
            transparent
            opacity={0.08}
            side={THREE.BackSide}
          />
        </mesh>
      </group>

      {/* =========================================================================
          3. MARS (The Red Planet with Polar Caps)
         ========================================================================= */}
      <group ref={marsRef} position={[-26.0, 7.5, -18.0]}>
        <mesh>
          <sphereGeometry args={[0.38, 32, 32]} />
          <meshStandardMaterial
            map={marsTexture}
            roughness={0.85}
            metalness={0.1}
          />
        </mesh>
        {/* Subtle atmospheric reddish haze */}
        <mesh>
          <sphereGeometry args={[0.39, 32, 32]} />
          <meshBasicMaterial
            color="#f97316"
            transparent
            opacity={0.12}
            side={THREE.BackSide}
          />
        </mesh>
      </group>

      {/* =========================================================================
          4. JUPITER (Gas Giant with Great Red Spot & Galilean Moons)
         ========================================================================= */}
      <group ref={jupiterRef} position={[36.0, -11.0, -28.0]}>
        <mesh>
          <sphereGeometry args={[1.25, 32, 32]} />
          <meshStandardMaterial
            map={jupiterTexture}
            roughness={0.65}
            metalness={0.05}
          />
        </mesh>

        {/* Jovian Atmospheric Glow */}
        <mesh>
          <sphereGeometry args={[1.28, 32, 32]} />
          <meshBasicMaterial
            color="#fed7aa"
            transparent
            opacity={0.1}
            side={THREE.BackSide}
          />
        </mesh>

        {/* 4 Galilean Moons (Io, Europa, Ganymede, Callisto) */}
        <mesh position={[1.9, 0.1, 0.4]}>
          <sphereGeometry args={[0.04, 8, 8]} />
          <meshBasicMaterial color="#fef08a" />
        </mesh>
        <mesh position={[2.5, -0.15, -0.6]}>
          <sphereGeometry args={[0.035, 8, 8]} />
          <meshBasicMaterial color="#e2e8f0" />
        </mesh>
        <mesh position={[3.3, 0.25, 0.9]}>
          <sphereGeometry args={[0.06, 8, 8]} />
          <meshBasicMaterial color="#cbd5e1" />
        </mesh>
        <mesh position={[4.2, -0.2, -1.2]}>
          <sphereGeometry args={[0.05, 8, 8]} />
          <meshBasicMaterial color="#94a3b8" />
        </mesh>
      </group>

      {/* =========================================================================
          5. SATURN (Golden Gas Giant with Majestic Tilted 3D Rings)
         ========================================================================= */}
      <group ref={saturnRef} position={[-42.0, -15.0, 32.0]}>
        {/* Saturn Planet Sphere */}
        <mesh>
          <sphereGeometry args={[0.85, 32, 32]} />
          <meshStandardMaterial
            map={saturnTexture}
            roughness={0.7}
            metalness={0.05}
          />
        </mesh>

        {/* Saturn 3D Rings System (Tilted at 26.7°) */}
        <mesh rotation={[Math.PI * 0.38, 0.2, 0]}>
          <ringGeometry args={[1.15, 2.35, 64]} />
          <meshStandardMaterial
            map={saturnRingsTexture}
            side={THREE.DoubleSide}
            transparent
            opacity={0.88}
            roughness={0.6}
          />
        </mesh>
      </group>

      {/* =========================================================================
          6. VENUS (Brilliant Morning/Evening Celestial Star)
         ========================================================================= */}
      <group position={[18.0, 12.0, 14.0]}>
        <mesh>
          <sphereGeometry args={[0.26, 16, 16]} />
          <meshBasicMaterial color="#fffbeb" />
        </mesh>
        <mesh>
          <planeGeometry args={[1.6, 1.6]} />
          <meshBasicMaterial
            map={sunCoronaTexture}
            transparent
            opacity={0.65}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
            side={THREE.DoubleSide}
          />
        </mesh>
      </group>

      {/* =========================================================================
          7. DEEP SPACE COSMIC STARFIELD (14,000 Multi-Colored Stellar Points)
         ========================================================================= */}
      <points>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            args={[starPositions, 3]}
          />
          <bufferAttribute
            attach="attributes-color"
            args={[starColors, 3]}
          />
        </bufferGeometry>
        <pointsMaterial
          size={1.3}
          vertexColors
          transparent
          opacity={0.92}
          sizeAttenuation={true}
        />
      </points>
    </group>
  );
};

export default CelestialBackground;
