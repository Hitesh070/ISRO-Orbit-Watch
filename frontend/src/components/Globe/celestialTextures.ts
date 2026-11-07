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
