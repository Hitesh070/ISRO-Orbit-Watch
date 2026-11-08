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
const CELESTRAK_SATCAT_ACTIVE_URL = 'https://celestrak.org/satcat/records.php?GROUP=active&FORMAT=JSON';
const GITHUB_CONJUNCTIONS_URL = 'https://raw.githubusercontent.com/Hitesh070/Orbit-Guard/main/data/conjunctions.json';

// Minimum refresh throttle: 2 hours (in ms)
const MIN_REFRESH_INTERVAL_MS = 2 * 60 * 60 * 1000;

export const normalizeCelestrakObjectType = (value: unknown): 'Satellite' | 'Debris' | 'Unknown' => {
  const type = String(value ?? '').trim().toUpperCase();
  if (['PAYLOAD', 'PAY', 'SATELLITE'].includes(type)) return 'Satellite';
  if (['DEBRIS', 'DEB', 'ROCKET BODY', 'R/B', 'RB'].includes(type)) return 'Debris';
  return 'Unknown';
};

const tleChecksum = (line: string): number => {
  let sum = 0;
  for (const char of line.slice(0, 68)) {
    if (char >= '0' && char <= '9') sum += Number(char);
    else if (char === '-') sum += 1;
  }
  return sum % 10;
};

const formatBstar = (value: number): string => {
  if (value === 0) return ' 00000+0';
  const exponent = Math.floor(Math.log10(Math.abs(value))) + 1;
  let mantissa = Math.round((value / (10 ** exponent)) * 100000);
  let normalizedExponent = exponent;
  if (mantissa >= 100000) {
    mantissa = Math.round(mantissa / 10);
    normalizedExponent += 1;
  }
  if (Math.abs(normalizedExponent) > 9 || Math.abs(mantissa) > 99999) throw new Error('BSTAR cannot be represented in TLE format');
  return `${value < 0 ? '-' : ' '}${String(Math.abs(mantissa)).padStart(5, '0')}${normalizedExponent >= 0 ? '+' : '-'}${Math.abs(normalizedExponent)}`;
};

export const ommToTle = (item: any, noradId: number): { line1: string; line2: string } | null => {
  try {
    // satellite.js TLE parsing only supports the legacy five-digit catalog number.
    if (noradId > 99999) return null;
    const required = ['EPOCH', 'CLASSIFICATION_TYPE', 'MEAN_MOTION', 'MEAN_MOTION_DOT', 'BSTAR', 'ELEMENT_SET_NO', 'INCLINATION', 'RA_OF_ASC_NODE', 'ECCENTRICITY', 'ARG_OF_PERICENTER', 'MEAN_ANOMALY', 'REV_AT_EPOCH'];
    if (required.some((key) => item[key] === undefined || item[key] === null || item[key] === '')) return null;
    const epoch = new Date(item.EPOCH);
    if (!Number.isFinite(epoch.getTime())) return null;
    const epochYear = String(epoch.getUTCFullYear() % 100).padStart(2, '0');
    const yearStart = Date.UTC(epoch.getUTCFullYear(), 0, 1);
    const dayOfYear = (epoch.getTime() - yearStart) / 86400000 + 1;
    const epochField = `${epochYear}${dayOfYear.toFixed(8).padStart(12, '0')}`;
    const mmDot = Number(item.MEAN_MOTION_DOT);
    const bstar = Number(item.BSTAR);
    const mm = Number(item.MEAN_MOTION);
    const inc = Number(item.INCLINATION);
    const raan = Number(item.RA_OF_ASC_NODE);
    const ecc = Number(item.ECCENTRICITY);
    const argp = Number(item.ARG_OF_PERICENTER);
    const meanAnomaly = Number(item.MEAN_ANOMALY);
    const elementSet = Number(item.ELEMENT_SET_NO);
    const rev = Number(item.REV_AT_EPOCH);
    if (![mmDot, bstar, mm, inc, raan, ecc, argp, meanAnomaly, elementSet, rev].every(Number.isFinite)) return null;
    if (mm <= 0 || ecc < 0 || ecc >= 1 || inc < 0 || inc > 180) return null;

    const intl = String(item.OBJECT_ID || '').match(/^(\d{4})-(\d{3})([A-Z]{0,3})$/i);
    const designator = intl ? `${intl[1].slice(-2)}${intl[2]}${intl[3].toUpperCase()}`.padEnd(8, ' ') : '        ';
    const derivative = `${mmDot < 0 ? '-' : ' '}${Math.abs(mmDot).toFixed(8).slice(1)}`;
    const line1raw = `1 ${String(noradId).padStart(5, '0')}${String(item.CLASSIFICATION_TYPE).trim()[0]} ${designator} ${epochField} ${derivative}  00000-0 ${formatBstar(bstar)} 0 ${String(elementSet % 10000).padStart(4, ' ')}`;
    const eccField = String(Math.round(ecc * 1e7)).padStart(7, '0');
    const line2raw = `2 ${String(noradId).padStart(5, '0')} ${inc.toFixed(4).padStart(8, ' ')} ${raan.toFixed(4).padStart(8, ' ')} ${eccField} ${argp.toFixed(4).padStart(8, ' ')} ${meanAnomaly.toFixed(4).padStart(8, ' ')} ${mm.toFixed(8).padStart(11, ' ')}${String(rev % 100000).padStart(5, ' ')}`;
    const line1 = `${line1raw.slice(0, 68).padEnd(68, ' ')}${tleChecksum(line1raw)}`;
    const line2 = `${line2raw.slice(0, 68).padEnd(68, ' ')}${tleChecksum(line2raw)}`;
    return line1.length === 69 && line2.length === 69 ? { line1, line2 } : null;
  } catch {
    return null;
  }
};

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
      fetchTime: '',
      source: 'Bundled Offline Snapshot',
      satellitesCount: catalog.filter((s) => s.object_type === 'Satellite').length,
      debrisCount: catalog.filter((s) => s.object_type !== 'Satellite').length,
      isOffline: true,
    };
    const cachedAttemptTime = Date.parse(meta.lastRefreshAttempt || meta.lastSyncAttempt || meta.fetchTime || '');
    if (Number.isFinite(cachedAttemptTime)) this.lastFetchTimestamp = cachedAttemptTime;

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
        const catalog = JSON.parse(raw);
        if (!Array.isArray(catalog)) return null;
        // Normalize pre-fix GP caches too; CelesTrak uses PAYLOAD/DEBRIS/ROCKET BODY,
        // while the renderer expects the app's Satellite/Debris categories.
        return catalog.map((item) => ({
          ...item,
          object_type: normalizeCelestrakObjectType(item.object_type ?? item.OBJECT_TYPE),
        }));
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
        const data = JSON.parse(raw);
        const screenTime = Date.parse(data.screen_time_utc || '');
        const ageMs = Date.now() - screenTime;
        if (!Number.isFinite(screenTime) || ageMs < -5 * 60 * 1000 || ageMs > 6 * 60 * 60 * 1000 || data.screening_status === 'unavailable') return null;
        const conjunctions = Array.isArray(data.conjunctions) ? data.conjunctions.map((event: any) => {
          const source = String(event.covariance_source || '').toLowerCase();
          if (source.includes('cdm') && !source.includes('synthetic')) return event;
          return {
            ...event,
            pc_foster: null,
            pc_max: null,
            collision_probability: null,
            mahalanobis_dist: null,
            k_at_pc_max: null,
            hbr_m: null,
            probability_status: 'Unavailable: measured object covariance was not supplied',
            encounter_plane_2d: undefined,
          };
        }) : [];
        return { ...data, conjunctions };
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
        const meta = JSON.parse(raw) as DataCacheMetadata;
        const catalog = this.getCachedCatalog();
        if (catalog?.length) {
          const satellitesCount = catalog.filter((item) => item.object_type === 'Satellite').length;
          const debrisCount = catalog.filter((item) => item.object_type === 'Debris').length;
          return {
            ...meta,
            total_objects: catalog.length,
            active_satellites: satellitesCount,
            debris_objects: debrisCount,
            unclassified_objects: catalog.filter((item) => item.object_type === 'Unknown').length,
            satellitesCount,
            debrisCount,
          };
        }
        return meta;
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

    // Persist attempts separately from successful fetches. This also prevents an
    // unavailable SATCAT endpoint from forcing a large Active GP download on
    // every application launch.
    this.lastFetchTimestamp = now;
    const lastRefreshAttempt = new Date(now).toISOString();
    const cachedMeta = this.getCachedMetadata();
    if (cachedMeta) {
      this.atomicWriteJson(this.metaPath, { ...cachedMeta, lastRefreshAttempt });
    }

    console.log('[DataManager] Initiating background CelesTrak OMM/GP synchronization...');

    try {
      const [celestrakJson, satcatJson, conjunctionsJson] = await Promise.allSettled([
        this.httpGet(CELESTRAK_ACTIVE_URL, this.etagCatalog),
        this.httpGet(CELESTRAK_SATCAT_ACTIVE_URL),
        this.httpGet(GITHUB_CONJUNCTIONS_URL),
      ]);

      if (satcatJson.status === 'rejected') {
        console.warn('[DataManager] SATCAT classification unavailable; catalog objects will remain unclassified unless verified metadata is cached:', satcatJson.reason?.message || satcatJson.reason);
      }

      let updated = false;

      // Handle CelesTrak catalog response
      if (celestrakJson.status === 'fulfilled' && celestrakJson.value.data) {
        const rawBody = celestrakJson.value.data;
        const parsed = JSON.parse(rawBody);

        const satcatById = new Map<number, any>();
        if (satcatJson.status === 'fulfilled' && satcatJson.value.data) {
          try {
            const satcatRecords = JSON.parse(satcatJson.value.data);
            if (Array.isArray(satcatRecords)) {
              for (const record of satcatRecords) {
                const id = Number(record.NORAD_CAT_ID);
                if (Number.isSafeInteger(id) && id > 0) satcatById.set(id, record);
              }
            }
          } catch (err: any) {
            console.warn('[DataManager] Could not parse CelesTrak SATCAT metadata:', err.message);
          }
        }

        if (Array.isArray(parsed) && parsed.length > 0) {
          // Normalise to OrbitGuard schema with Keplerian altitude calculations
          const GM = 398600.4418;
          const EARTH_RADIUS = 6378.137;

          const readNumber = (...values: any[]): number | null => {
            for (const value of values) {
              if (value === null || value === undefined || value === '') continue;
              const number = Number(value);
              if (Number.isFinite(number)) return number;
            }
            return null;
          };
          let unsupportedNoradIds = 0;
          const normalized = parsed.flatMap((item: any) => {
            const noradId = readNumber(item.NORAD_CAT_ID, item.norad_id);
            if (noradId !== null && noradId > 99999) {
              unsupportedNoradIds++;
              return [];
            }
            const mm = readNumber(item.MEAN_MOTION, item.mean_motion);
            const ecc = readNumber(item.ECCENTRICITY, item.eccentricity);
            const inclination = readNumber(item.INCLINATION, item.inclination);
            const raan = readNumber(item.RA_OF_ASC_NODE, item.ra_of_asc_node);
            const argPericenter = readNumber(item.ARG_OF_PERICENTER, item.arg_of_pericenter);
            const meanAnomaly = readNumber(item.MEAN_ANOMALY, item.mean_anomaly);
            const epoch = item.EPOCH || item.epoch;
            const epochMs = typeof epoch === 'string' ? Date.parse(epoch) : Number.NaN;
            const name = item.OBJECT_NAME || item.name;
            if (
              noradId === null || noradId <= 0 || mm === null || mm <= 0 ||
              ecc === null || ecc < 0 || ecc >= 1 || inclination === null ||
              inclination < 0 || inclination > 180 || raan === null ||
              argPericenter === null || meanAnomaly === null ||
              !Number.isFinite(epochMs) || !name
            ) return [];
            const satcat = satcatById.get(noradId);

            const n_rad_s = (mm * 2 * Math.PI) / 86400;
            const a = Math.pow(GM / (n_rad_s * n_rad_s), 1 / 3);
            const perigee = a * (1 - ecc) - EARTH_RADIUS;
            const apogee = a * (1 + ecc) - EARTH_RADIUS;
            const alt = a - EARTH_RADIUS;
            const period = Math.round((86400 / mm / 60) * 10) / 10;

            const nativeLine1 = item.TLE_LINE1 || item.line1;
            const nativeLine2 = item.TLE_LINE2 || item.line2;
            const converted = nativeLine1 && nativeLine2 ? null : ommToTle(item, noradId);
            const l1 = nativeLine1 || converted?.line1 || '';
            const l2 = nativeLine2 || converted?.line2 || '';
            if (!l1 || !l2) return [];

            return [{
              norad_id: noradId,
              name,
              object_type: normalizeCelestrakObjectType(satcat?.OBJECT_TYPE ?? item.OBJECT_TYPE ?? item.object_type),
              country: satcat?.OWNER || item.COUNTRY_CODE || item.country || 'Unknown',
              epoch: new Date(epochMs).toISOString(),
              mean_motion: mm,
              eccentricity: ecc,
              inclination,
              ra_of_asc_node: raan,
              arg_of_pericenter: argPericenter,
              mean_anomaly: meanAnomaly,
              bstar: readNumber(item.BSTAR, item.bstar),
              semi_major_axis_km: Math.round(a * 100) / 100,
              perigee_km: Math.round(perigee * 100) / 100,
              apogee_km: Math.round(apogee * 100) / 100,
              alt_km: Math.round(alt * 100) / 100,
              period_min: period,
              line1: l1,
              line2: l2,
              tle_line1: l1,
              tle_line2: l2,
              is_isro: ['IND', 'INDIA', 'INDIA (ISRO)'].includes(String(satcat?.OWNER || item.COUNTRY_CODE || item.country || '').trim().toUpperCase()),
            }];
          });

          if (normalized.length === 0) {
            return { success: false, error: 'CelesTrak response contained no records with complete valid orbital elements.' };
          }

          const mergedCatalog = normalized;

          // Atomic write merged catalog to catalog.json
          this.atomicWriteJson(this.catalogPath, mergedCatalog);
          this.etagCatalog = celestrakJson.value.etag || null;

          const checksum = crypto.createHash('sha256').update(rawBody).digest('hex');
          const satellitesCount = normalized.filter((item: any) => item.object_type === 'Satellite').length;
          const debrisCount = normalized.filter((item: any) => item.object_type === 'Debris').length;
          const meta: DataCacheMetadata = {
            fetchTime: new Date().toISOString(),
            source: satcatById.size > 0
              ? 'CelesTrak Active GP + SATCAT (Direct Desktop Fetch)'
              : 'CelesTrak Active GP (SATCAT classification unavailable)',
            classification_version: satcatById.size > 0 ? 1 : undefined,
            unclassified_objects: normalized.filter((item: any) => item.object_type === 'Unknown').length,
            total_objects: normalized.length,
            active_satellites: satellitesCount,
            debris_objects: debrisCount,
            excluded_unsupported_norad_ids: unsupportedNoradIds,
            satellitesCount,
            debrisCount,
            isroCount: normalized.filter((item: any) => item.is_isro).length,
            oldestEpoch: normalized.map((item: any) => item.epoch).sort()[0],
            newestEpoch: normalized.map((item: any) => item.epoch).sort().at(-1),
            checksum,
            isOffline: false,
            lastSyncAttempt: new Date().toISOString(),
            lastRefreshAttempt,
          };

          this.atomicWriteJson(this.metaPath, meta);
          updated = true;

          console.log(`[DataManager] Successfully refreshed ${normalized.length} catalog records from CelesTrak.`);
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
