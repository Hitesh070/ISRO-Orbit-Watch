import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { DataManager } from '../main/dataManager';

describe('Desktop DataManager Offline-First Caching', () => {
  let testDataDir: string;
  let testBundleDir: string;
  let dataManager: DataManager;

  beforeEach(() => {
    // Create temporary isolated folders for testing
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'orbitguard-test-'));
    testDataDir = path.join(tempRoot, 'data');
    testBundleDir = path.join(tempRoot, 'bundled');

    fs.mkdirSync(testDataDir, { recursive: true });
    fs.mkdirSync(testBundleDir, { recursive: true });

    // Seed dummy bundled files
    fs.writeFileSync(
      path.join(testBundleDir, 'catalog.json'),
      JSON.stringify([{ norad_cat_id: 25544, object_name: 'ISS (ZARYA)', object_type: 'Satellite' }])
    );
    fs.writeFileSync(
      path.join(testBundleDir, 'meta.json'),
      JSON.stringify({
        fetchTime: '2026-11-06T12:00:00Z',
        source: 'Bundled Snapshot',
        satellitesCount: 1,
        debrisCount: 0,
        isOffline: true,
      })
    );
    fs.writeFileSync(
      path.join(testBundleDir, 'conjunctions.json'),
      JSON.stringify({ highRiskEvents: [] })
    );

    dataManager = new DataManager(testDataDir, testBundleDir);
  });

  afterEach(() => {
    try {
      const parent = path.dirname(testDataDir);
      fs.rmSync(parent, { recursive: true, force: true });
    } catch (e) {}
  });

  it('ensures cache directory is created', () => {
    expect(fs.existsSync(testDataDir)).toBe(true);
  });

  it('performs atomic writes without leaving orphaned .tmp files', () => {
    const targetFile = path.join(testDataDir, 'test-atomic.json');
    const data = { timestamp: Date.now(), name: 'Test Sat' };

    dataManager.atomicWriteJson(targetFile, data);

    expect(fs.existsSync(targetFile)).toBe(true);
    expect(fs.existsSync(`${targetFile}.tmp`)).toBe(false);

    const read = JSON.parse(fs.readFileSync(targetFile, 'utf8'));
    expect(read.name).toBe('Test Sat');
  });

  it('seeds cache from bundled snapshot when cache is unpopulated', () => {
    const catalogPath = path.join(testDataDir, 'catalog.json');
    expect(fs.existsSync(catalogPath)).toBe(false);

    // Call seed
    dataManager.seedFromBundledSnapshot();

    expect(fs.existsSync(catalogPath)).toBe(true);
    const cached = dataManager.getCachedCatalog();
    expect(cached).toBeDefined();
    expect(cached?.length).toBe(1);
    expect(cached?.[0].object_name).toBe('ISS (ZARYA)');
  });

  it('reads cached conjunctions and metadata accurately', () => {
    dataManager.seedFromBundledSnapshot();

    const meta = dataManager.getCachedMetadata();
    expect(meta).toBeDefined();
    expect(meta?.source).toBe('Bundled Snapshot');
    expect(meta?.satellitesCount).toBe(1);

    const conj = dataManager.getCachedConjunctions();
    expect(conj).toBeDefined();
    expect(conj?.highRiskEvents).toEqual([]);
  });

  it('clears cached data and resets to pristine bundled snapshot', () => {
    // Seed initial
    dataManager.seedFromBundledSnapshot();
    const catalogPath = path.join(testDataDir, 'catalog.json');
    expect(fs.existsSync(catalogPath)).toBe(true);

    // Overwrite with custom modified data
    fs.writeFileSync(catalogPath, JSON.stringify([{ norad_cat_id: 99999, object_name: 'MODIFIED_SAT' }]));
    let cached = dataManager.getCachedCatalog();
    expect(cached?.[0].object_name).toBe('MODIFIED_SAT');

    // Clear cache - should re-seed pristine bundled snapshot
    dataManager.clearCache();
    cached = dataManager.getCachedCatalog();
    expect(cached?.[0].object_name).toBe('ISS (ZARYA)');
  });
});
