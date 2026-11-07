/**
 * OrbitGuard Desktop Offline-First Data Manager (Phase W4)
 * ========================================================
 * Manages atomic offline caching in %APPDATA%/OrbitGuard/data/, bundled snapshot fallbacks,
 * direct CelesTrak OMM/GP API background fetching (with ETag / If-Modified-Since),
 * and precomputed conjunctions synchronization from GitHub releases.
 */

import path from 'path';
import fs from 'fs';
import https from 'https';
import crypto from 'crypto';
import { app } from 'electron';
import { DataCacheMetadata } from '../../frontend/src/shared/ipc';

const USER_AGENT = 'OrbitGuard-Desktop/4.2.0 (ISRO-SSA; +https://github.com/Hitesh070/Orbit-Guard)';
const CELESTRAK_ACTIVE_URL = 'https://celestrak.org/NORAD/elements/gp.php?GROUP=active&FORMAT=json';
const GITHUB_CONJUNCTIONS_URL = 'https://raw.githubusercontent.com/Hitesh070/Orbit-Guard/main/data/conjunctions.json';

// Minimum refresh throttle: 2 hours (in ms)
const MIN_REFRESH_INTERVAL_MS = 2 * 60 * 60 * 1000;

export class DataManager {
  private dataDir: string;
  private catalogPath: string;
  private metaPath: string;
  private conjunctionsPath: string;
  private bundledSnapshotDir: string;
  private onUpdateCallback?: (meta: DataCacheMetadata) => void;
  private lastFetchTimestamp = 0;
  private etagCatalog: string | null = null;

  constructor(customDataDir?: string, customBundledDir?: string) {
    this.dataDir = customDataDir || (app?.getPath ? path.join(app.getPath('userData'), 'data') : path.join(process.cwd(), '.test-data'));
    this.catalogPath = path.join(this.dataDir, 'catalog.json');
    this.metaPath = path.join(this.dataDir, 'meta.json');
    this.conjunctionsPath = path.join(this.dataDir, 'conjunctions.json');

    // Bundled fallback snapshot in extraResources or project resources
    const devFallback = (app?.getAppPath && fs.existsSync(path.join(app.getAppPath(), 'resources/catalog-snapshot')))
      ? path.join(app.getAppPath(), 'resources/catalog-snapshot')
      : path.join(__dirname, '../../../resources/catalog-snapshot');

    this.bundledSnapshotDir = customBundledDir || (app?.isPackaged
      ? path.join(process.resourcesPath, 'catalog-snapshot')
      : devFallback);

    this.ensureDirectories();
  }

  private ensureDirectories() {
    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true });
    }
  }

  public setOnUpdateListener(cb: (meta: DataCacheMetadata) => void) {
    this.onUpdateCallback = cb;
  }

  /**
   * Initializes data on app startup:
   * 1. Loads disk cache if present.
   * 2. If empty, seeds from bundled snapshot.
   * 3. Triggers non-blocking background refresh if online and interval has elapsed.
   */
  public async initialize(): Promise<{ catalog: any[]; meta: DataCacheMetadata }> {
    this.ensureDirectories();

    // Seed from bundled snapshot if cache does not exist
    if (!fs.existsSync(this.catalogPath)) {
      this.seedFromBundledSnapshot();
    }

    const catalog = this.getCachedCatalog() || [];
    const meta = this.getCachedMetadata() || {
      fetchTime: new Date().toISOString(),
      source: 'Bundled Offline Snapshot',
      satellitesCount: catalog.filter((s) => s.object_type === 'Satellite').length,
      debrisCount: catalog.filter((s) => s.object_type !== 'Satellite').length,
      isOffline: true,
    };

    // Schedule non-blocking background refresh after a short 3-second startup grace period
    setTimeout(() => {
      this.refreshDataInBackground().catch((err) => {
        console.warn('[DataManager] Background refresh non-fatal error:', err.message);
      });
    }, 3000);

    return { catalog, meta };
  }

  public getCachedCatalog(): any[] | null {
    try {
      if (fs.existsSync(this.catalogPath)) {
        const raw = fs.readFileSync(this.catalogPath, 'utf8');
        return JSON.parse(raw);
      }
    } catch (err: any) {
      console.error('[DataManager] Failed reading cached catalog.json:', err.message);
    }
    return null;
  }

  public getCachedConjunctions(): any | null {
    try {
      if (fs.existsSync(this.conjunctionsPath)) {
        const raw = fs.readFileSync(this.conjunctionsPath, 'utf8');
        return JSON.parse(raw);
      }
    } catch (err: any) {
      console.warn('[DataManager] Failed reading cached conjunctions.json:', err.message);
    }
    return null;
  }

  public getCachedMetadata(): DataCacheMetadata | null {
    try {
      if (fs.existsSync(this.metaPath)) {
        const raw = fs.readFileSync(this.metaPath, 'utf8');
        return JSON.parse(raw);
      }
    } catch (err: any) {
      console.warn('[DataManager] Failed reading cached meta.json:', err.message);
    }
    return null;
  }

  public async clearCache(): Promise<void> {
    try {
      if (fs.existsSync(this.catalogPath)) fs.unlinkSync(this.catalogPath);
      if (fs.existsSync(this.metaPath)) fs.unlinkSync(this.metaPath);
      if (fs.existsSync(this.conjunctionsPath)) fs.unlinkSync(this.conjunctionsPath);
      this.seedFromBundledSnapshot();
    } catch (err: any) {
      console.error('[DataManager] Error clearing cache:', err.message);
    }
  }

  /**
   * Seeds the local cache from bundled snapshot files.
   */
  public seedFromBundledSnapshot() {
    try {
      const bundledCat = path.join(this.bundledSnapshotDir, 'catalog.json');
      const bundledMeta = path.join(this.bundledSnapshotDir, 'meta.json');
      const bundledConj = path.join(this.bundledSnapshotDir, 'conjunctions.json');

      if (fs.existsSync(bundledCat)) {
        fs.copyFileSync(bundledCat, this.catalogPath);
        console.log('[DataManager] Seeded catalog.json from bundled snapshot.');
      }
      if (fs.existsSync(bundledMeta)) {
        fs.copyFileSync(bundledMeta, this.metaPath);
      }
      if (fs.existsSync(bundledConj)) {
        fs.copyFileSync(bundledConj, this.conjunctionsPath);
      }
    } catch (err: any) {
      console.warn('[DataManager] Could not seed from bundled snapshot:', err.message);
    }
  }

  /**
   * Fetches fresh CelesTrak OMM/GP data directly via Node.js HTTPS (no CORS restrictions).
   * Executes atomic file writing (write .tmp -> rename) to prevent corrupt files.
   */
  public async refreshDataInBackground(force = false): Promise<{ success: boolean; error?: string }> {
    const now = Date.now();
    if (!force && now - this.lastFetchTimestamp < MIN_REFRESH_INTERVAL_MS) {
      return { success: true };
    }

    console.log('[DataManager] Initiating background CelesTrak OMM/GP synchronization...');

    try {
      const [celestrakJson, conjunctionsJson] = await Promise.allSettled([
        this.httpGet(CELESTRAK_ACTIVE_URL, this.etagCatalog),
        this.httpGet(GITHUB_CONJUNCTIONS_URL),
      ]);

      let updated = false;

      // Handle CelesTrak catalog response
      if (celestrakJson.status === 'fulfilled' && celestrakJson.value.data) {
        const rawBody = celestrakJson.value.data;
        const parsed = JSON.parse(rawBody);

        if (Array.isArray(parsed) && parsed.length > 0) {
          // Normalise to OrbitGuard schema with Keplerian altitude calculations
          const GM = 398600.4418;
          const EARTH_RADIUS = 6378.137;

          const normalized = parsed.map((item: any) => {
            const mm = Number(item.MEAN_MOTION || item.mean_motion) || 15.0;
            const ecc = Number(item.ECCENTRICITY || item.eccentricity) || 0.001;
            const n_rad_s = (mm * 2 * Math.PI) / 86400;
            const a = Math.pow(GM / (n_rad_s * n_rad_s), 1 / 3);
            const perigee = Math.max(120, a * (1 - ecc) - EARTH_RADIUS);
            const apogee = Math.max(120, a * (1 + ecc) - EARTH_RADIUS);
            const alt = Math.max(120, a - EARTH_RADIUS);
            const period = Math.round((86400 / mm / 60) * 10) / 10;

            const l1 = item.TLE_LINE1 || item.line1 || '';
            const l2 = item.TLE_LINE2 || item.line2 || '';

            return {
              norad_id: Number(item.NORAD_CAT_ID || item.norad_id),
              name: item.OBJECT_NAME || item.name || `OBJECT ${item.NORAD_CAT_ID}`,
              object_type: item.OBJECT_TYPE || 'Satellite',
              country: item.COUNTRY_CODE || item.country || 'International',
              epoch: item.EPOCH || new Date().toISOString(),
              mean_motion: mm,
              eccentricity: ecc,
              inclination: Number(item.INCLINATION || item.inclination) || 51.6,
              ra_of_asc_node: Number(item.RA_OF_ASC_NODE || item.ra_of_asc_node) || 0.0,
              arg_of_pericenter: Number(item.ARG_OF_PERICENTER || item.arg_of_pericenter) || 0.0,
              mean_anomaly: Number(item.MEAN_ANOMALY || item.mean_anomaly) || 0.0,
              bstar: Number(item.BSTAR || item.bstar) || 0.0001,
              semi_major_axis_km: Math.round(a * 100) / 100,
              perigee_km: Math.round(perigee * 100) / 100,
              apogee_km: Math.round(apogee * 100) / 100,
              alt_km: Math.round(alt * 100) / 100,
              period_min: period,
              line1: l1,
              line2: l2,
              tle_line1: l1,
              tle_line2: l2,
              is_isro:
                String(item.COUNTRY_CODE).toUpperCase() === 'IND' ||
                /cartosat|risat|chandrayaan|aditya|eos|insat|gsat|irnss|nisar/i.test(item.OBJECT_NAME || ''),
            };
          });

          // PRESERVE AND MERGE DEBRIS OBJECTS (Ensure debris count NEVER drops to 0)
          let existingDebris: any[] = [];
          try {
            const currentCat = this.getCachedCatalog();
            if (currentCat && currentCat.length > 0) {
              existingDebris = currentCat.filter((item: any) => item.object_type !== 'Satellite');
            }
          } catch {}

          if (existingDebris.length === 0) {
            try {
              const bundledPath = path.join(this.bundledSnapshotDir, 'catalog.json');
              if (fs.existsSync(bundledPath)) {
                const bundled = JSON.parse(fs.readFileSync(bundledPath, 'utf8'));
                existingDebris = bundled.filter((item: any) => item.object_type !== 'Satellite');
              }
            } catch {}
          }

          const mergedCatalog = [...normalized, ...existingDebris];

          // Atomic write merged catalog to catalog.json
          this.atomicWriteJson(this.catalogPath, mergedCatalog);
          this.etagCatalog = celestrakJson.value.etag || null;

          const checksum = crypto.createHash('sha256').update(rawBody).digest('hex');
          const meta: DataCacheMetadata = {
            fetchTime: new Date().toISOString(),
            source: 'CelesTrak CCSDS GP API (Direct Desktop Fetch)',
            satellitesCount: normalized.length,
            debrisCount: existingDebris.length,
            checksum,
            isOffline: false,
            lastSyncAttempt: new Date().toISOString(),
          };

          this.atomicWriteJson(this.metaPath, meta);
          this.lastFetchTimestamp = now;
          updated = true;

          console.log(`[DataManager] Successfully refreshed catalog: ${normalized.length} satellites, ${existingDebris.length} debris preserved (Total: ${mergedCatalog.length}).`);
          if (this.onUpdateCallback) {
            this.onUpdateCallback(meta);
          }
        }
      }

      // Handle conjunctions response
      if (conjunctionsJson.status === 'fulfilled' && conjunctionsJson.value.data) {
        try {
          const parsedConj = JSON.parse(conjunctionsJson.value.data);
          this.atomicWriteJson(this.conjunctionsPath, parsedConj);
          console.log('[DataManager] Successfully synced conjunctions.json.');
        } catch (e) {}
      }

      return { success: true };
    } catch (err: any) {
      console.warn('[DataManager] Refresh failed:', err.message);
      return { success: false, error: err.message };
    }
  }

  /**
   * Atomic file writing helper: writes to path.tmp then renames atomically.
   */
  public atomicWriteJson(targetPath: string, data: any) {
    const tmpPath = `${targetPath}.tmp`;
    const payload = JSON.stringify(data, null, 2);
    fs.writeFileSync(tmpPath, payload, 'utf8');
    fs.renameSync(tmpPath, targetPath);
  }

  /**
   * HTTPS GET with timeout, User-Agent, and ETag support.
   */
  private httpGet(urlStr: string, etag?: string | null): Promise<{ data: string | null; etag?: string }> {
    return new Promise((resolve, reject) => {
      const headers: Record<string, string> = {
        'User-Agent': USER_AGENT,
        Accept: 'application/json, text/plain, */*',
      };
      if (etag) {
        headers['If-None-Match'] = etag;
      }

      const req = https.get(urlStr, { headers, timeout: 12000 }, (res) => {
        if (res.statusCode === 304) {
          // Not modified
          resolve({ data: null, etag: etag ?? undefined });
          return;
        }

        if (res.statusCode !== 200) {
          reject(new Error(`HTTP ${res.statusCode}: ${res.statusMessage}`));
          return;
        }

        let body = '';
        res.setEncoding('utf8');
        res.on('data', (chunk) => {
          body += chunk;
        });
        res.on('end', () => {
          const newEtag = (res.headers['etag'] as string) || undefined;
          resolve({ data: body, etag: newEtag });
        });
      });

      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Request timed out'));
      });

      req.on('error', (err) => {
        reject(err);
      });
    });
  }
}
