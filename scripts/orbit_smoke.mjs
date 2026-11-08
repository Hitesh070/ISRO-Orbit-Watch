import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const data = JSON.parse(await fs.readFile(path.join(root, 'frontend/public/data/catalog.json'), 'utf8'));
const manifest = JSON.parse(await fs.readFile(path.join(root, 'frontend/public/data/meta.json'), 'utf8'));
assert.equal(data.length, manifest.total_objects, 'manifest count must equal catalog size');
assert(data.length > 0, 'catalog must contain real records');
assert(data.every((row) => ['IND', 'ISRO'].includes(row.OWNER) && row.OBJECT_TYPE === 'PAY'), 'catalog must include India-owned payloads only');

const tempEntry = path.join(os.tmpdir(), `india-orbit-smoke-${process.pid}.mjs`);
const esbuildFile = path.join(root, 'frontend/node_modules/esbuild/lib/main.js');
const { build } = await import(pathToFileURL(esbuildFile));
try {
  await build({
    entryPoints: [path.join(root, 'frontend/src/orbit.ts')],
    outfile: tempEntry,
    bundle: true,
    format: 'esm',
    platform: 'node',
    logLevel: 'silent',
  });
  const orbit = await import(pathToFileURL(tempEntry).href);
  const lowOrbitRadius = orbit.altitudeToEarthRadii(525);
  const geostationaryRadius = orbit.altitudeToEarthRadii(35786);
  assert(Math.abs(lowOrbitRadius - 1.0823) < 0.001, '525 km orbit must use its true Earth-radius scale');
  assert(Math.abs(geostationaryRadius - 6.611) < 0.002, 'geostationary altitude must use its true Earth-radius scale');
  assert(geostationaryRadius > lowOrbitRadius * 6, 'GEO and LEO must not render at nearly the same radius');
  const now = new Date();
  let propagated = 0;
  for (const record of data) {
    const satrec = orbit.makeSatRec(record);
    const position = orbit.calculatePosition(record, satrec, now);
    assert(position, `SGP4 position unavailable for catalog ${record.NORAD_CAT_ID}`);
    assert(Number.isFinite(position.latitude) && Math.abs(position.latitude) <= 90, 'latitude must be finite and geodetic');
    assert(Number.isFinite(position.longitude) && Math.abs(position.longitude) <= 180, 'longitude must be finite and geodetic');
    assert(Number.isFinite(position.altitudeKm) && position.altitudeKm > 0, 'altitude must be finite and above Earth surface');
    assert(Number.isFinite(position.speedKmS) && position.speedKmS > 0, 'velocity must be finite and positive');
    propagated += 1;
  }

  const selected = data.find((row) => row.OBJECT_NAME === 'ASTROSAT') ?? data.find((row) => Number(row.MEAN_MOTION) > 13 && Number(row.MEAN_MOTION) < 17);
  assert(selected, 'a low-Earth-orbit payload is needed for the pass check');
  const satrec = orbit.makeSatRec(selected);
  const periodMinutes = 1440 / Number(selected.MEAN_MOTION);
  const track = orbit.predictOrbitTrack(satrec, now, periodMinutes);
  assert.equal(track.length, 145, 'one-orbit path should have all 145 samples');
  assert(track.flat().every(Number.isFinite), 'orbit path coordinates must be finite');
  const pass = orbit.predictNextPass(satrec, { latitudeDeg: 12.9716, longitudeDeg: 77.5946, altitudeM: 920, maskDeg: 10 }, now, 72);
  assert(pass, `next pass not found for ${selected.OBJECT_NAME} over Bengaluru within 72 hours`);
  assert(pass.aos < pass.los, 'pass rise must precede pass set');
  assert(pass.maxElevationDeg >= 10, 'pass maximum elevation must reach the requested mask');
  assert(Number.isFinite(pass.aos.getTime()) && Number.isFinite(pass.los.getTime()), 'pass timestamps must be valid');

  const globeSource = await fs.readFile(path.join(root, 'frontend/src/Globe.tsx'), 'utf8');
  assert(!globeSource.includes('Math.random'), 'globe must not use runtime randomness');
  console.log(`PASS: ${propagated} / ${data.length} records propagated; orbit scale 525 km=${lowOrbitRadius.toFixed(3)} R⊕ / 35,786 km=${geostationaryRadius.toFixed(3)} R⊕; ${track.length} orbit samples; ${selected.OBJECT_NAME} next pass over Bengaluru at ${pass.maxElevationDeg.toFixed(1)} deg max elevation.`);
} finally {
  await fs.rm(tempEntry, { force: true });
}
