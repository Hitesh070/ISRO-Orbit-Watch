/**
 * Procedural Celestial Texture Generators for OrbitGuard
 * ======================================================
 * Deterministically generates high-resolution planetary and stellar textures
 * using HTML5 Canvas with zero network overhead.
 */

import * as THREE from 'three';

// Cache generated textures in memory
const textureCache = new Map<string, THREE.CanvasTexture>();

/**
 * Procedural Moon Texture (1024x512)
 * Features lunar maria (dark basaltic plains), crater rims, and bright ejecta rays.
 */
export function getMoonTexture(): THREE.CanvasTexture {
  if (textureCache.has('moon')) return textureCache.get('moon')!;

  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  // 1. Base cratered highland grey
  ctx.fillStyle = '#8a919e';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // 2. High-frequency noise overlay
  const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imgData.data;
  for (let i = 0; i < data.length; i += 4) {
    const n = (Math.random() - 0.5) * 36;
    data[i] = Math.max(0, Math.min(255, data[i] + n));
    data[i + 1] = Math.max(0, Math.min(255, data[i + 1] + n));
    data[i + 2] = Math.max(0, Math.min(255, data[i + 2] + n));
  }
  ctx.putImageData(imgData, 0, 0);

  // 3. Basaltic Lunar Maria (Dark smooth regions)
  const maria = [
    { x: 380, y: 190, rx: 110, ry: 75, r: 0.1 },  // Oceanus Procellarum
    { x: 490, y: 160, rx: 75, ry: 60, r: -0.2 }, // Mare Imbrium
    { x: 580, y: 180, rx: 65, ry: 50, r: 0.1 },  // Mare Serenitatis
    { x: 640, y: 220, rx: 70, ry: 55, r: 0.3 },  // Mare Tranquillitatis
    { x: 670, y: 190, rx: 45, ry: 40, r: 0.0 },  // Mare Crisium
    { x: 440, y: 260, rx: 70, ry: 50, r: 0.2 },  // Mare Nubium
  ];

  ctx.fillStyle = 'rgba(52, 57, 66, 0.72)';
  for (const m of maria) {
    ctx.save();
    ctx.translate(m.x, m.y);
    ctx.rotate(m.r);
    ctx.beginPath();
    ctx.ellipse(0, 0, m.rx, m.ry, 0, 0, Math.PI * 2);
    ctx.filter = 'blur(14px)';
    ctx.fill();
    ctx.restore();
  }
  ctx.filter = 'none';

  // 4. Prominent Impact Craters with Ray Systems (Tycho, Copernicus)
  const craters = [
    { x: 460, y: 360, r: 18, name: 'Tycho' },
    { x: 470, y: 210, r: 14, name: 'Copernicus' },
    { x: 410, y: 220, r: 10, name: 'Kepler' },
    { x: 530, y: 220, r: 12, name: 'Plato' },
    { x: 720, y: 280, r: 15, name: 'Langrenus' },
  ];

  for (const c of craters) {
    // Bright ejecta rays
    ctx.strokeStyle = 'rgba(235, 240, 250, 0.25)';
    ctx.lineWidth = 1.2;
    for (let a = 0; a < Math.PI * 2; a += Math.PI / 8) {
      ctx.beginPath();
      ctx.moveTo(c.x, c.y);
      const rayLen = c.r * (3 + Math.random() * 4);
      ctx.lineTo(c.x + Math.cos(a) * rayLen, c.y + Math.sin(a) * rayLen);
      ctx.stroke();
    }

    // Crater rim & shadow
    ctx.beginPath();
    ctx.arc(c.x, c.y, c.r, 0, Math.PI * 2);
    ctx.fillStyle = '#454a54';
    ctx.fill();
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = '#d5dbe6';
    ctx.stroke();

    // Central peak
    ctx.beginPath();
    ctx.arc(c.x, c.y, c.r * 0.2, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  textureCache.set('moon', texture);
  return texture;
}

/**
 * Procedural Jupiter Texture (1024x512)
 * Features atmospheric storm belts and the iconic Great Red Spot.
 */
export function getJupiterTexture(): THREE.CanvasTexture {
  if (textureCache.has('jupiter')) return textureCache.get('jupiter')!;

  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  // Jovian atmospheric color bands
  const bands = [
    { y1: 0, y2: 45, color: '#685444' },    // North Polar
    { y1: 45, y2: 90, color: '#9d7c64' },   // North Temperate
    { y1: 90, y2: 140, color: '#d8b998' },  // North Tropical Zone
    { y1: 140, y2: 210, color: '#96482a' }, // North Equatorial Belt
    { y1: 210, y2: 250, color: '#f3e8d2' }, // Equatorial Zone
    { y1: 250, y2: 320, color: '#964324' }, // South Equatorial Belt
    { y1: 320, y2: 380, color: '#d5b28d' }, // South Tropical Zone
    { y1: 380, y2: 440, color: '#906d54' }, // South Temperate
    { y1: 440, y2: 512, color: '#5e4839' }, // South Polar
  ];

  for (const b of bands) {
    const grad = ctx.createLinearGradient(0, b.y1, 0, b.y2);
    grad.addColorStop(0, b.color);
    grad.addColorStop(0.5, b.color);
    grad.addColorStop(1, bands[Math.min(bands.length - 1, bands.indexOf(b) + 1)].color);
    ctx.fillStyle = grad;
    ctx.fillRect(0, b.y1, canvas.width, b.y2 - b.y1);
  }

  // Wavy turbulence swirls between belts
  ctx.fillStyle = 'rgba(255, 255, 255, 0.18)';
  for (let y = 80; y < 440; y += 35) {
    ctx.beginPath();
    for (let x = 0; x <= canvas.width; x += 15) {
      const dy = Math.sin(x * 0.04) * 6 + Math.cos(x * 0.08) * 3;
      if (x === 0) ctx.moveTo(x, y + dy);
      else ctx.lineTo(x, y + dy);
    }
    ctx.lineWidth = 4;
    ctx.strokeStyle = y % 70 === 0 ? 'rgba(80, 30, 15, 0.35)' : 'rgba(255, 240, 220, 0.35)';
    ctx.stroke();
  }

  // The Great Red Spot (Anticyclonic Storm in South Equatorial Belt)
  const spotX = 620;
  const spotY = 285;
  const spotGrad = ctx.createRadialGradient(spotX, spotY, 4, spotX, spotY, 48);
  spotGrad.addColorStop(0, '#e64a19');
  spotGrad.addColorStop(0.5, '#c83810');
  spotGrad.addColorStop(0.9, '#a02c0b');
  spotGrad.addColorStop(1, 'rgba(160, 44, 11, 0)');

  ctx.save();
  ctx.translate(spotX, spotY);
  ctx.scale(1.8, 1.0);
  ctx.beginPath();
  ctx.arc(0, 0, 32, 0, Math.PI * 2);
  ctx.fillStyle = spotGrad;
  ctx.fill();

  // White inner vortex core
  ctx.beginPath();
  ctx.arc(-2, 0, 9, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255, 230, 210, 0.65)';
  ctx.fill();
  ctx.restore();

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  textureCache.set('jupiter', texture);
  return texture;
}

/**
 * Procedural Saturn Texture (512x256) & Concentric Rings Texture
 */
export function getSaturnTexture(): THREE.CanvasTexture {
  if (textureCache.has('saturn')) return textureCache.get('saturn')!;

  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  // Subtle golden-buff atmospheric belts
  const grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
  grad.addColorStop(0.0, '#75684f'); // North polar
  grad.addColorStop(0.2, '#baa67f');
  grad.addColorStop(0.4, '#e6cf9f');
  grad.addColorStop(0.5, '#f5e4bd'); // Bright equatorial
  grad.addColorStop(0.6, '#e6cf9f');
  grad.addColorStop(0.8, '#baa67f');
  grad.addColorStop(1.0, '#695c44'); // South polar

  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Delicate micro-striping
  ctx.fillStyle = 'rgba(0, 0, 0, 0.04)';
  for (let y = 0; y < canvas.height; y += 4) {
    if (y % 8 === 0) ctx.fillRect(0, y, canvas.width, 2);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  textureCache.set('saturn', texture);
  return texture;
}

/**
 * Procedural Saturn Rings Alpha Texture (1D radial profile mapped to 512x64)
 */
export function getSaturnRingsTexture(): THREE.CanvasTexture {
  if (textureCache.has('saturn_rings')) return textureCache.get('saturn_rings')!;

  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 16;
  const ctx = canvas.getContext('2d')!;

  // Map radial ring density from inside (left) to outside (right)
  const grad = ctx.createLinearGradient(0, 0, canvas.width, 0);
  grad.addColorStop(0.0, 'rgba(0, 0, 0, 0)');
  grad.addColorStop(0.12, 'rgba(180, 160, 130, 0.15)'); // Ring C (Crepe)
  grad.addColorStop(0.28, 'rgba(220, 200, 160, 0.85)'); // Ring B (Bright dense)
  grad.addColorStop(0.58, 'rgba(235, 215, 175, 0.95)'); // Outer Ring B
  grad.addColorStop(0.60, 'rgba(0, 0, 0, 0.02)');       // Cassini Division (Gap)
  grad.addColorStop(0.66, 'rgba(0, 0, 0, 0.02)');
  grad.addColorStop(0.68, 'rgba(210, 190, 150, 0.75)'); // Ring A
  grad.addColorStop(0.88, 'rgba(190, 170, 135, 0.65)'); // Encke Gap zone
  grad.addColorStop(0.96, 'rgba(160, 140, 110, 0.35)');
  grad.addColorStop(1.0, 'rgba(0, 0, 0, 0)');

  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const texture = new THREE.CanvasTexture(canvas);
  textureCache.set('saturn_rings', texture);
  return texture;
}

/**
 * Procedural Mars Texture (512x256)
 * Features rusty red deserts, darker volcanic plains, and brilliant white polar caps.
 */
export function getMarsTexture(): THREE.CanvasTexture {
  if (textureCache.has('mars')) return textureCache.get('mars')!;

  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  // 1. Rusty iron oxide desert base
  ctx.fillStyle = '#b35128';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // 2. Dark albedo volcanic terrain (Syrtis Major, Sinus Sabaeus)
  ctx.fillStyle = 'rgba(70, 42, 30, 0.65)';
  const darkFeatures = [
    { x: 190, y: 130, rx: 65, ry: 40 },
    { x: 340, y: 145, rx: 90, ry: 35 },
    { x: 260, y: 170, rx: 50, ry: 25 },
  ];
  for (const f of darkFeatures) {
    ctx.beginPath();
    ctx.ellipse(f.x, f.y, f.rx, f.ry, 0, 0, Math.PI * 2);
    ctx.filter = 'blur(10px)';
    ctx.fill();
  }
  ctx.filter = 'none';

  // 3. Polar Ice Caps (North and South)
  ctx.fillStyle = '#ffffff';
  // North polar cap
  ctx.beginPath();
  ctx.ellipse(canvas.width / 2, 8, 80, 18, 0, 0, Math.PI * 2);
  ctx.fill();

  // South polar cap
  ctx.beginPath();
  ctx.ellipse(canvas.width / 2, canvas.height - 8, 65, 14, 0, 0, Math.PI * 2);
  ctx.fill();

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  textureCache.set('mars', texture);
  return texture;
}

/**
 * Procedural Solar Corona Glow Sprite Texture (512x512)
 * Produces soft realistic coronal radiation flare with exponential optical falloff.
 */
export function getSunCoronaTexture(): THREE.CanvasTexture {
  if (textureCache.has('sun_corona')) return textureCache.get('sun_corona')!;

  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  const cx = 256;
  const cy = 256;
  const grad = ctx.createRadialGradient(cx, cy, 15, cx, cy, 250);
  grad.addColorStop(0.0, 'rgba(255, 255, 255, 1.0)');
  grad.addColorStop(0.12, 'rgba(255, 240, 180, 0.95)');
  grad.addColorStop(0.35, 'rgba(255, 175, 50, 0.55)');
  grad.addColorStop(0.65, 'rgba(255, 100, 20, 0.18)');
  grad.addColorStop(0.90, 'rgba(255, 50, 10, 0.04)');
  grad.addColorStop(1.0, 'rgba(0, 0, 0, 0)');

  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const texture = new THREE.CanvasTexture(canvas);
  textureCache.set('sun_corona', texture);
  return texture;
}

/**
 * Procedural Photorealistic Milky Way Skybox Panorama Texture (2048x1024)
 * Generates an authentic deep-space panoramic cosmos:
 *  - Infinite cosmic dark velvet base (#010206)
 *  - Tilted galactic plane (~60.2° inclination)
 *  - Radiant golden-pearl galactic core bulge (Sagittarius A*)
 *  - Diffuse star clouds (Scutum, Cygnus, Carina)
 *  - Interstellar dark dust absorption lanes (The Great Rift)
 *  - 25,000 microscopic embedded background stars
 */
export function getMilkyWaySkyboxTexture(): THREE.CanvasTexture {
  if (textureCache.has('milkyway')) return textureCache.get('milkyway')!;

  if (typeof document === 'undefined') {
    return new THREE.Texture() as THREE.CanvasTexture;
  }

  const canvas = document.createElement('canvas');
  canvas.width = 2048;
  canvas.height = 1024;
  const ctx = canvas.getContext('2d')!;

  // 1. Deepest Cosmic Black Base with faint ambient starlight
  ctx.fillStyle = '#010206';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // 2. Faint cosmic infrared / cosmic dust background glow
  const baseGrad = ctx.createRadialGradient(
    canvas.width * 0.45,
    canvas.height * 0.5,
    50,
    canvas.width * 0.45,
    canvas.height * 0.5,
    canvas.width * 0.5
  );
  baseGrad.addColorStop(0.0, 'rgba(18, 24, 45, 0.4)');
  baseGrad.addColorStop(0.4, 'rgba(8, 12, 25, 0.2)');
  baseGrad.addColorStop(1.0, 'rgba(1, 2, 6, 0.0)');
  ctx.fillStyle = baseGrad;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // 3. Galactic Plane Spline Curve (Sinusoidal projection of the inclined galactic disk)
  const getGalacticY = (x: number) => {
    return canvas.height * 0.5 + Math.sin((x / canvas.width) * Math.PI * 2 - 0.7) * (canvas.height * 0.28);
  };

  // 4. Paint Broad Diffuse Galactic Star Cloud Band
  const steps = 120;
  for (let i = 0; i <= steps; i++) {
    const x = (i / steps) * canvas.width;
    const y = getGalacticY(x);

    // Distance to Galactic Core (centered near x = 0.46 * width)
    const distToCore = Math.abs(x - canvas.width * 0.46);
    const coreFactor = Math.max(0, 1.0 - distToCore / (canvas.width * 0.35));

    const cloudRadius = 70 + coreFactor * 90;
    const grad = ctx.createRadialGradient(x, y, 5, x, y, cloudRadius);
    const coreAlpha = (0.16 + coreFactor * 0.35).toFixed(3);
    const midAlpha = (0.08 + coreFactor * 0.18).toFixed(3);
    grad.addColorStop(0.0, `rgba(${Math.round(210 + coreFactor * 45)}, ${Math.round(215 + coreFactor * 30)}, ${Math.round(245 - coreFactor * 35)}, ${coreAlpha})`);
    grad.addColorStop(0.5, `rgba(160, 180, 225, ${midAlpha})`);
    grad.addColorStop(1.0, 'rgba(1, 2, 6, 0)');

    ctx.save();
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.ellipse(x, y, cloudRadius * 1.6, cloudRadius, 0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // 5. Galactic Bulge (The Golden Core in Sagittarius)
  const coreX = canvas.width * 0.46;
  const coreY = getGalacticY(coreX);
  const coreGrad = ctx.createRadialGradient(coreX, coreY, 10, coreX, coreY, 180);
  coreGrad.addColorStop(0.0, 'rgba(255, 245, 220, 0.75)');
  coreGrad.addColorStop(0.2, 'rgba(255, 225, 175, 0.55)');
  coreGrad.addColorStop(0.5, 'rgba(210, 185, 145, 0.28)');
  coreGrad.addColorStop(0.8, 'rgba(120, 130, 180, 0.10)');
  coreGrad.addColorStop(1.0, 'rgba(1, 2, 6, 0.0)');

  ctx.save();
  ctx.translate(coreX, coreY);
  ctx.rotate(0.35);
  ctx.scale(2.2, 1.0);
  ctx.beginPath();
  ctx.arc(0, 0, 120, 0, Math.PI * 2);
  ctx.fillStyle = coreGrad;
  ctx.fill();
  ctx.restore();

  // 6. Interstellar Dark Dust Absorption Lanes (The Great Rift)
  ctx.fillStyle = 'rgba(1, 2, 6, 0.72)';
  for (let i = 0; i < 70; i++) {
    const x = canvas.width * 0.32 + (i / 70) * (canvas.width * 0.38);
    const gy = getGalacticY(x);
    const yOffset = (Math.sin(i * 0.4) * 18) + (Math.sin(i * 1.1) * 8);
    const rx = 18 + Math.sin(i) * 10;
    const ry = 8 + Math.cos(i * 0.8) * 5;

    ctx.save();
    ctx.beginPath();
    ctx.ellipse(x, gy + yOffset, rx, ry, 0.25, 0, Math.PI * 2);
    ctx.filter = 'blur(6px)';
    ctx.fill();
    ctx.restore();
  }
  ctx.filter = 'none';

  // 7. Subtle Hydrogen-Alpha Emission Nebulae (Carina / Orion / Cygnus)
  const nebulae = [
    { x: canvas.width * 0.28, y: getGalacticY(canvas.width * 0.28) + 15, color: 'rgba(230, 60, 110, 0.18)', r: 45 },
    { x: canvas.width * 0.65, y: getGalacticY(canvas.width * 0.65) - 20, color: 'rgba(215, 50, 95, 0.16)', r: 55 },
    { x: canvas.width * 0.42, y: getGalacticY(canvas.width * 0.42) - 30, color: 'rgba(50, 150, 220, 0.15)', r: 40 },
  ];
  for (const n of nebulae) {
    const nGrad = ctx.createRadialGradient(n.x, n.y, 2, n.x, n.y, n.r);
    nGrad.addColorStop(0.0, n.color);
    nGrad.addColorStop(1.0, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = nGrad;
    ctx.beginPath();
    ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
    ctx.fill();
  }

  // 8. Scatter 22,000 Microscopic Stellar Points
  const starCount = 22000;
  for (let i = 0; i < starCount; i++) {
    let sx: number;
    let sy: number;
    const inGalacticBand = i < 16000;

    if (inGalacticBand) {
      sx = Math.random() * canvas.width;
      const gy = getGalacticY(sx);
      const gOffset = (Math.random() + Math.random() + Math.random() - 1.5) * 60;
      sy = gy + gOffset;
      if (sy < 0) sy += canvas.height;
      if (sy >= canvas.height) sy -= canvas.height;
    } else {
      sx = Math.random() * canvas.width;
      sy = Math.random() * canvas.height;
    }

    const bright = Math.random();
    const alpha = (0.2 + bright * 0.75).toFixed(2);
    const size = bright > 0.98 ? 1.5 : bright > 0.85 ? 1.0 : 0.6;

    let starColor = `rgba(255, 255, 255, ${alpha})`;
    if (bright < 0.15) starColor = `rgba(180, 210, 255, ${alpha})`;
    else if (bright > 0.95) starColor = `rgba(255, 220, 170, ${alpha})`;

    ctx.fillStyle = starColor;
    ctx.fillRect(sx, sy, size, size);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  textureCache.set('milkyway', texture);
  return texture;
}
