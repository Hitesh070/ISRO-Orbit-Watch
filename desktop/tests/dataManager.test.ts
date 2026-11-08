import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { DataManager, ommToTle, normalizeCelestrakObjectType } from '../main/dataManager';
import * as satellite from '../../frontend/node_modules/satellite.js';

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
      JSON.stringify({ screen_time_utc: new Date().toISOString(), highRiskEvents: [], conjunctions: [] })
    );

    dataManager = new DataManager(testDataDir, testBundleDir);
  });

  afterEach(() => {
    try {
      const parent = path.dirname(testDataDir);
      fs.rmSync(parent, { recursive: true, force: true });
    } catch (e) {}
  });

  it('converts complete OMM GP fields into a valid TLE and rejects unsupported IDs', () => {
    const omm = {
      OBJECT_ID: '1998-067A',
      EPOCH: '2024-01-01T00:00:00.000Z',
      CLASSIFICATION_TYPE: 'U',
      MEAN_MOTION: 15.5,
      MEAN_MOTION_DOT: 0.0001,
      BSTAR: 0.0001,
      ELEMENT_SET_NO: 999,
      INCLINATION: 51.64,
      RA_OF_ASC_NODE: 120.5,
      ECCENTRICITY: 0.0005,
      ARG_OF_PERICENTER: 80.25,
      MEAN_ANOMALY: 210.75,
      REV_AT_EPOCH: 12345,
    };
    const tle = ommToTle(omm, 25544);
    expect(tle?.line1).toHaveLength(69);
    expect(tle?.line2).toHaveLength(69);
    expect(satellite.twoline2satrec(tle!.line1, tle!.line2).error).toBe(0);
    expect(ommToTle(omm, 100000)).toBeNull();
    expect(ommToTle({ ...omm, BSTAR: undefined }, 25544)).toBeNull();
  });

  it('maps official CelesTrak object types and repairs existing cache counts', () => {
    expect(normalizeCelestrakObjectType('PAYLOAD')).toBe('Satellite');
    expect(normalizeCelestrakObjectType('ROCKET BODY')).toBe('Debris');
    expect(normalizeCelestrakObjectType('DEBRIS')).toBe('Debris');
    expect(normalizeCelestrakObjectType('UNK')).toBe('Unknown');

    fs.writeFileSync(path.join(testDataDir, 'catalog.json'), JSON.stringify([
      { norad_id: 1, name: 'Payload', object_type: 'PAYLOAD' },
      { norad_id: 2, name: 'Stage', object_type: 'ROCKET BODY' },
      { norad_id: 3, name: 'Fragment', object_type: 'DEBRIS' },
      { norad_id: 4, name: 'Unclassified', object_type: 'UNK' },
    ]));
    fs.writeFileSync(path.join(testDataDir, 'meta.json'), JSON.stringify({
      fetchTime: '2026-11-08T12:00:00Z',
      source: 'CelesTrak test cache',
      satellitesCount: 4,
      debrisCount: 0,
      isOffline: false,
    }));

    const cached = dataManager.getCachedCatalog();
    expect(cached?.map((item) => item.object_type)).toEqual(['Satellite', 'Debris', 'Debris', 'Unknown']);
    const meta = dataManager.getCachedMetadata();
    expect(meta?.satellitesCount).toBe(1);
    expect(meta?.debrisCount).toBe(2);
    expect(meta?.total_objects).toBe(4);
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
