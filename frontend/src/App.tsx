import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Activity, AlertTriangle, ArrowUpRight, CalendarClock, ChevronRight, CircleHelp, Clock3, Compass, Crosshair, Database, Globe2, LoaderCircle, MapPin, Orbit, Radio, RefreshCw, Search, Satellite, ShieldCheck, Signal, Sparkles } from 'lucide-react';
import Globe from './Globe';
import { calculatePosition, makeSatRec, predictNextPass, predictOrbitTrack } from './orbit';
import { missionProfile } from './missionProfiles';
import type { CatalogManifest, OmmRecord, SatellitePosition } from './types';

const BUNDLED_DATA_ROOT = 'data';
const PUBLIC_DATA_ROOT = 'https://raw.githubusercontent.com/Hitesh070/Orbit-Guard/main/frontend/public/data';
const STORAGE_KEY = 'isro-orbit-watch-cache-v1';
const INDIA_OWNER_CODES = new Set(['IND', 'ISRO']);

type LoadState = 'loading' | 'online' | 'bundled' | 'offline' | 'error';

interface LocalSnapshot {
  manifest: CatalogManifest;
  satellites: OmmRecord[];
}

function validCatalog(manifest: CatalogManifest, satellites: OmmRecord[]): boolean {
  if (!Array.isArray(satellites) || satellites.length === 0) return false;
  if (!manifest.fetch_time_utc || !Number.isFinite(Date.parse(manifest.fetch_time_utc))) return false;
  if (!Number.isSafeInteger(manifest.total_objects) || manifest.total_objects !== satellites.length) return false;
  if (!Number.isFinite(manifest.stale_after_hours) || manifest.stale_after_hours <= 0 || manifest.stale_after_hours > 72) return false;
  const ids = new Set<number>();
  for (const item of satellites) {
    const id = Number(item.NORAD_CAT_ID);
    if (!Number.isSafeInteger(id) || id <= 0 || ids.has(id)) return false;
    if (!INDIA_OWNER_CODES.has(String(item.OWNER).trim().toUpperCase())) return false;
    if (item.OBJECT_TYPE !== 'PAY') return false;
    if (!item.OBJECT_NAME?.trim() || !Number.isFinite(Date.parse(item.EPOCH))) return false;
    if (!(Number(item.MEAN_MOTION) > 0) || !(Number(item.ECCENTRICITY) >= 0 && Number(item.ECCENTRICITY) < 1)) return false;
    if (![item.INCLINATION, item.RA_OF_ASC_NODE, item.ARG_OF_PERICENTER, item.MEAN_ANOMALY].every((value) => Number.isFinite(Number(value)))) return false;
    ids.add(id);
  }
  return true;
}

interface ManifestResult {
  manifest: CatalogManifest;
  dataRoot: string;
  isPublic: boolean;
}

async function fetchManifest(): Promise<ManifestResult> {
  let publicFailure = '';
  try {
    const response = await fetch(`${PUBLIC_DATA_ROOT}/meta.json?check=${Date.now()}`, { cache: 'no-store' });
    if (!response.ok) throw new Error(`Public catalog status check failed (${response.status}).`);
    return { manifest: await response.json(), dataRoot: PUBLIC_DATA_ROOT, isPublic: true };
  } catch (error) {
    publicFailure = error instanceof Error ? error.message : 'Public catalog is unreachable.';
  }
  const bundled = await fetch(`${BUNDLED_DATA_ROOT}/meta.json`, { cache: 'no-store' });
  if (!bundled.ok) throw new Error(`${publicFailure} Packaged catalog is missing.`);
  return { manifest: await bundled.json(), dataRoot: BUNDLED_DATA_ROOT, isPublic: false };
}

async function fetchSnapshot(manifest: CatalogManifest, dataRoot: string): Promise<LocalSnapshot> {
  const response = await fetch(`${dataRoot}/catalog.json?v=${encodeURIComponent(manifest.fetch_time_utc)}`, { cache: 'no-store' });
  if (!response.ok) throw new Error(`Satellite catalog download failed (${response.status}).`);
  const satellites = await response.json() as OmmRecord[];
  if (!validCatalog(manifest, satellites)) throw new Error('The catalog failed Indian ownership or orbital-element checks.');
  return { manifest, satellites };
}

function readLocalSnapshot(): LocalSnapshot | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const snapshot = JSON.parse(raw) as LocalSnapshot;
    return validCatalog(snapshot.manifest, snapshot.satellites) ? snapshot : null;
  } catch {
    return null;
  }
}

function timeAgeLabel(ageMs: number): string {
  if (ageMs < 60_000) return 'just now';
  const minutes = Math.floor(ageMs / 60_000);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = minutes / 60;
  if (hours < 24) return `${hours.toFixed(hours >= 10 ? 0 : 1)} hr ago`;
  return `${(hours / 24).toFixed(1)} days ago`;
}

function formatUtc(date: Date): string {
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: 'UTC', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  }).format(date) + ' UTC';
}

function formatCoord(value: number, positive: string, negative: string): string {
  return `${Math.abs(value).toFixed(2)}° ${value >= 0 ? positive : negative}`;
}

function getPeriodMinutes(record: OmmRecord): number {
  return 1440 / Number(record.MEAN_MOTION);
}

export default function App() {
  const [manifest, setManifest] = useState<CatalogManifest | null>(null);
  const [satellites, setSatellites] = useState<OmmRecord[]>([]);
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [sourceError, setSourceError] = useState('');
  const [lastCheck, setLastCheck] = useState<Date | null>(null);
  const [now, setNow] = useState(() => new Date());
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [query, setQuery] = useState('');
  const [panel, setPanel] = useState<'overview' | 'passes' | 'about'>('overview');
  const [observerFields, setObserverFields] = useState({ latitude: '', longitude: '', altitude: '', mask: '10' });
  const [pass, setPass] = useState<{ aos: Date; los: Date; maxElevationDeg: number } | null>(null);
  const [passError, setPassError] = useState('');
  const [passLoading, setPassLoading] = useState(false);
  const [clockText, setClockText] = useState(() => formatUtc(new Date()));
  const manifestRef = useRef(manifest);
  const satellitesRef = useRef(satellites);
  manifestRef.current = manifest;
  satellitesRef.current = satellites;

  const refresh = useCallback(async (isInitial = false) => {
    try {
      const manifestResult = await fetchManifest();
      const nextManifest = manifestResult.manifest;
      const currentManifest = manifestRef.current;
      const currentSatellites = satellitesRef.current;
      const needsCatalog = !currentManifest || currentManifest.fetch_time_utc !== nextManifest.fetch_time_utc || currentSatellites.length === 0;
      if (needsCatalog) {
        const snapshot = await fetchSnapshot(nextManifest, manifestResult.dataRoot);
        setManifest(snapshot.manifest);
        setSatellites(snapshot.satellites);
        setSelectedId((current) => current && snapshot.satellites.some((s) => Number(s.NORAD_CAT_ID) === current)
          ? current
          : null);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
      } else {
        setManifest((current) => current?.fetch_time_utc === nextManifest.fetch_time_utc ? current : nextManifest);
      }
      setLoadState(manifestResult.isPublic ? 'online' : 'bundled');
      setSourceError('');
      setLastCheck(new Date());
    } catch (error) {
      const message = error instanceof Error ? error.message : 'The catalog could not be checked.';
      setSourceError(message);
      setLastCheck(new Date());
      const cached = readLocalSnapshot();
      if (cached) {
        if (manifestRef.current?.fetch_time_utc !== cached.manifest.fetch_time_utc) {
          setManifest(cached.manifest);
          setSatellites(cached.satellites);
        }
        setLoadState('offline');
      } else if (isInitial) {
        setLoadState('error');
      }
    }
  }, []);

  useEffect(() => {
    void refresh(true);
    const checkTimer = window.setInterval(() => void refresh(false), 60_000);
    const clockTimer = window.setInterval(() => {
      const tick = new Date();
      setNow(tick);
      setClockText(formatUtc(tick));
    }, 1000);
    return () => {
      window.clearInterval(checkTimer);
      window.clearInterval(clockTimer);
    };
  }, [refresh]);

  const records = useMemo(() => {
    return satellites.map((record) => {
      try { return { record, satrec: makeSatRec(record) }; }
      catch { return null; }
    }).filter((entry): entry is { record: OmmRecord; satrec: ReturnType<typeof makeSatRec> } => entry !== null);
  }, [satellites]);

  const positions = useMemo(() => {
    const output: SatellitePosition[] = [];
    for (const entry of records) {
      const position = calculatePosition(entry.record, entry.satrec, now);
      if (position) output.push(position);
    }
    return output;
  }, [records, now]);

  const filteredPositions = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return positions;
    return positions.filter(({ record }) => record.OBJECT_NAME.toLowerCase().includes(normalized)
      || String(record.NORAD_CAT_ID).includes(normalized));
  }, [positions, query]);

  const selected = positions.find((item) => item.record.NORAD_CAT_ID === selectedId) ?? null;
  const selectedProfile = selected ? missionProfile(selected.record.OBJECT_NAME) : undefined;
  const selectedSatrec = records.find((item) => Number(item.record.NORAD_CAT_ID) === selectedId)?.satrec ?? null;
  const orbitTrack = useMemo(() => selectedSatrec && selected
    ? predictOrbitTrack(selectedSatrec, now, getPeriodMinutes(selected.record))
    : [], [selectedSatrec, selected, now]);

  const manifestAgeMs = manifest ? Math.max(0, now.getTime() - Date.parse(manifest.fetch_time_utc)) : Infinity;
  const dataIsStale = !!manifest && manifestAgeMs > manifest.stale_after_hours * 3_600_000;

  const runPassPrediction = useCallback(() => {
    if (!selectedSatrec) return;
    const values = Object.values(observerFields).map((value) => Number(value));
    const [latitudeDeg, longitudeDeg, altitudeM, maskDeg] = values;
    if (Object.values(observerFields).some((value) => value.trim() === '')
      || !values.every(Number.isFinite)
      || Math.abs(latitudeDeg) > 90 || Math.abs(longitudeDeg) > 180
      || altitudeM < -500 || altitudeM > 20_000 || maskDeg < 0 || maskDeg > 90) {
      setPassError('Enter valid latitude, longitude, site altitude, and elevation mask.');
      return;
    }
    setPassError('');
    setPass(null);
    setPassLoading(true);
    window.setTimeout(() => {
      try {
        const result = predictNextPass(selectedSatrec, { latitudeDeg, longitudeDeg, altitudeM, maskDeg }, new Date(), 72);
        setPass(result);
        if (!result) setPassError('No pass above this elevation mask was predicted in the next 72 hours.');
      } catch {
        setPassError('Pass prediction failed for these orbital elements.');
      } finally {
        setPassLoading(false);
      }
    }, 25);
  }, [observerFields, selectedSatrec]);

  const handleSelect = (id: number) => {
    setSelectedId(id);
    setPanel('overview');
    setPass(null);
    setPassError('');
  };

  const updateObserver = (key: keyof typeof observerFields, value: string) => {
    setObserverFields((fields) => ({ ...fields, [key]: value }));
    setPass(null);
    setPassError('');
  };

  return (
    <div className="app-shell">
      <header className="titlebar">
        <div className="brandmark"><Orbit size={18} /></div>
        <div className="brand-copy"><strong>ISRO ORBIT WATCH</strong><span>PUBLIC INDIAN SPACECRAFT TRACKING</span></div>
        <div className="titlebar-status"><span className={`status-led ${loadState === 'online' && !dataIsStale ? 'live' : 'warn'}`} />
          <span>{loadState === 'online' ? 'PUBLIC CATALOG CONNECTED' : loadState === 'bundled' ? 'PACKAGED SNAPSHOT' : loadState === 'offline' ? 'OFFLINE CACHE' : loadState === 'loading' ? 'CONNECTING' : 'DATA UNAVAILABLE'}</span>
        </div>
        <div className="clock-pill"><Clock3 size={14} /><span>{clockText}</span></div>
      </header>

      <div className="sourcebar">
        <div className="sourcebar-copy"><Database size={14} />
          <span>{manifest ? `CELESTRAK OMM / GP · checked ${formatUtc(new Date(manifest.fetch_time_utc))}` : 'WAITING FOR VERIFIED INDIAN SATELLITE CATALOG'}</span>
        </div>
        <div className="sourcebar-right">
          <span className={dataIsStale || loadState !== 'online' ? 'source-warn' : 'source-good'}>
            {loadState === 'online' && !dataIsStale ? 'PUBLIC SOURCE CURRENT' : loadState === 'bundled' ? 'PACKAGED SNAPSHOT' : loadState === 'offline' ? 'SHOWING CACHED SNAPSHOT' : dataIsStale ? 'SOURCE SNAPSHOT STALE' : 'SOURCE STATUS UNKNOWN'}
          </span>
          <button className="icon-button" title="Check catalog now" onClick={() => void refresh(false)}><RefreshCw size={15} /></button>
        </div>
      </div>

      {(dataIsStale || loadState === 'bundled' || loadState === 'offline' || loadState === 'error') && (
        <div className={`noticebar ${loadState === 'error' ? 'notice-error' : ''}`}>
          <AlertTriangle size={15} />
          <span>{loadState === 'bundled'
            ? `Public catalog could not be reached. Showing the packaged catalog from ${manifest ? formatUtc(new Date(manifest.fetch_time_utc)) : 'its recorded fetch time'}.`
            : loadState === 'offline'
            ? `Network check failed. Showing the last verified catalog from ${manifest ? formatUtc(new Date(manifest.fetch_time_utc)) : 'cache'}. ${sourceError}`
            : loadState === 'error'
              ? `No verified catalog is available. ${sourceError}`
              : `Catalog snapshot age is ${timeAgeLabel(manifestAgeMs)}. The globe still shows a model prediction, not sensor telemetry.`}</span>
        </div>
      )}

      <main className="main-layout">
        <aside className="left-rail">
          <div className="rail-heading">
            <div><div className="eyebrow">MISSION VIEW</div><h1>India in orbit</h1></div>
            <div className="count-badge">{positions.length.toString().padStart(2, '0')}</div>
          </div>
          <div className="search-box"><Search size={15} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Find a spacecraft" aria-label="Search Indian satellites" /></div>
          <div className="list-meta"><span>INDIAN PAYLOADS</span><span>{filteredPositions.length} TRACKED</span></div>
          <div className="satellite-list">
            {loadState === 'loading' && <div className="empty-state"><LoaderCircle className="spin" size={20} />Loading verified catalog…</div>}
            {loadState === 'error' && <div className="empty-state">No catalog is available. Try again after the data source is reachable.</div>}
            {filteredPositions.map((position) => (
              <button key={position.record.NORAD_CAT_ID} onClick={() => handleSelect(position.record.NORAD_CAT_ID)} className={`satellite-row ${selectedId === position.record.NORAD_CAT_ID ? 'selected' : ''}`}>
                <span className={`satellite-dot ${position.staleElements ? 'stale' : ''}`} />
                <span className="satellite-row-copy"><strong>{position.record.OBJECT_NAME}</strong><small>CAT {position.record.NORAD_CAT_ID} · {position.record.OWNER}</small></span>
                <span className="satellite-alt">{position.altitudeKm.toFixed(0)}<small>km</small></span>
              </button>
            ))}
            {loadState !== 'loading' && filteredPositions.length === 0 && <div className="empty-state">{positions.length ? 'No Indian spacecraft match that search.' : 'No valid Indian spacecraft are in the published catalog.'}</div>}
          </div>
          <div className="rail-footer"><ShieldCheck size={15} /><span>Ownership matched to public SATCAT records</span></div>
        </aside>

        <section className="globe-panel">
          <div className="globe-heading">
            <div><div className="eyebrow">NASA BLUE MARBLE · TRUE ORBIT SCALE</div><strong>Orbital positions</strong></div>
            <div className="globe-legend"><span><i className="legend-dot" />INDIAN PAYLOAD</span><span><i className="legend-dot amber" />OLD ELEMENTS</span></div>
          </div>
          <Globe positions={filteredPositions} selectedId={selectedId} orbitTrack={orbitTrack} onSelect={handleSelect} />
          <div className="map-hint"><Compass size={14} /><span>Drag to rotate · scroll to zoom · altitude shown to Earth scale</span></div>
          <div className="globe-footer">
            <div><span className="metric-label">POSITION TIME</span><strong>{clockText}</strong></div>
            <div><span className="metric-label">POSITION MODEL</span><strong>SGP4 / OMM</strong></div>
            <a href="https://bhoonidhi.nrsc.gov.in/upagrah" target="_blank" rel="noreferrer" className="official-link">Compare with ISRO Upagrah <ArrowUpRight size={14} /></a>
          </div>
        </section>

        <aside className="right-rail">
          <div className="right-heading"><div><div className="eyebrow">SPACECRAFT DETAILS</div><h2>{selected?.record.OBJECT_NAME ?? 'Select a satellite'}</h2></div><Satellite size={19} /></div>
          {selected ? (
            <>
              <div className="detail-id"><span>NORAD CATALOG</span><strong>{selected.record.NORAD_CAT_ID}</strong><span className="owner-tag">{selected.record.OWNER}</span></div>
              {selected.staleElements && <div className="element-alert"><AlertTriangle size={14} />Orbital elements are {timeAgeLabel(selected.ageHours * 3_600_000)} old.</div>}
              <div className="position-card">
                <div className="position-card-head"><MapPin size={15} /><span>MODEL POSITION</span><span className="pulse-dot" /></div>
                <div className="coordinates">{formatCoord(selected.latitude, 'N', 'S')}<br />{formatCoord(selected.longitude, 'E', 'W')}</div>
                <div className="position-grid">
                  <div><span>Altitude</span><strong>{selected.altitudeKm.toFixed(1)} <small>km</small></strong></div>
                  <div><span>Speed</span><strong>{selected.speedKmS.toFixed(3)} <small>km/s</small></strong></div>
                </div>
              </div>
              <div className="details-grid">
                <div className="data-cell"><span>Inclination</span><strong>{Number(selected.record.INCLINATION).toFixed(2)}°</strong></div>
                <div className="data-cell"><span>Period</span><strong>{(getPeriodMinutes(selected.record) / 60).toFixed(2)} hr</strong></div>
                <div className="data-cell"><span>Element epoch</span><strong>{new Date(selected.record.EPOCH).toLocaleDateString('en-IN', { timeZone: 'UTC', day: '2-digit', month: 'short', year: 'numeric' })}</strong></div>
                <div className="data-cell"><span>Element age</span><strong>{timeAgeLabel(selected.ageHours * 3_600_000)}</strong></div>
              </div>
              <div className="tab-row">
                <button className={panel === 'overview' ? 'active' : ''} onClick={() => setPanel('overview')}><Activity size={14} />Overview</button>
                <button className={panel === 'passes' ? 'active' : ''} onClick={() => setPanel('passes')}><CalendarClock size={14} />Passes</button>
                <button className={panel === 'about' ? 'active' : ''} onClick={() => setPanel('about')}><CircleHelp size={14} />About</button>
              </div>
              {panel === 'overview' && <div className="mission-overview">
                {selectedProfile?.image ? <div className="mission-photo-wrap">
                  <img className="mission-photo" src={selectedProfile.image} alt={`${selected.record.OBJECT_NAME} spacecraft`} onError={(event) => { event.currentTarget.style.display = 'none'; }} />
                  <span>SPACECRAFT IMAGE · {selectedProfile.imageCredit}</span>
                </div> : <div className="mission-photo-placeholder"><Satellite size={23} /><span>No verified spacecraft image in this profile</span></div>}
                <div className="mission-facts">
                  <div className="mission-fact"><span>LAUNCH DATE</span><strong>{selectedProfile?.launchDate ?? (selected.record.LAUNCH_DATE ? String(selected.record.LAUNCH_DATE).slice(0, 10) : 'Not listed in matched SATCAT data')}</strong></div>
                  <div className="mission-purpose">{selectedProfile?.purpose ?? 'A verified mission description is not available in this app profile. See the official ISRO spacecraft mission list.'}</div>
                  <a href={selectedProfile?.missionSource ?? 'https://www.isro.gov.in/SpacecraftMissions.html'} target="_blank" rel="noreferrer">Official mission details <ArrowUpRight size={13} /></a>
                </div>
                {selectedProfile?.dataUrl ? <div className="mission-data-card">
                  <div className="mission-data-heading"><Database size={14} /><strong>{selectedProfile.dataLabel}</strong></div>
                  <p>{selectedProfile.dataNote}</p>
                  <a href={selectedProfile.dataUrl} target="_blank" rel="noreferrer">Open official data portal <ArrowUpRight size={13} /></a>
                </div> : <div className="mission-data-card unavailable"><div className="mission-data-heading"><Radio size={14} /><strong>Public data availability</strong></div><p>No verified public sensor-product endpoint is listed for this spacecraft here. The orbit position is not a received signal or telemetry stream.</p></div>}
                <div className="detail-note"><Signal size={14} /><p>Position is propagated from the latest catalog element set. It is not live radio or spacecraft telemetry.</p></div>
              </div>}
              {panel === 'passes' && (
                <div className="pass-panel">
                  <div className="pass-intro">Enter a receiving site to predict the next pass. Nothing uses your device location automatically.</div>
                  <div className="coordinate-form">
                    <label>Latitude °<input inputMode="decimal" value={observerFields.latitude} onChange={(e) => updateObserver('latitude', e.target.value)} placeholder="e.g. 12.97" /></label>
                    <label>Longitude °<input inputMode="decimal" value={observerFields.longitude} onChange={(e) => updateObserver('longitude', e.target.value)} placeholder="e.g. 77.59" /></label>
                    <label>Site altitude m<input inputMode="decimal" value={observerFields.altitude} onChange={(e) => updateObserver('altitude', e.target.value)} placeholder="Required" /></label>
                    <label>Elevation mask °<input inputMode="decimal" value={observerFields.mask} onChange={(e) => updateObserver('mask', e.target.value)} /></label>
                  </div>
                  <button className="primary-button" onClick={runPassPrediction} disabled={passLoading}>{passLoading ? <LoaderCircle className="spin" size={15} /> : <Crosshair size={15} />}{passLoading ? 'Calculating…' : 'Predict next pass'}</button>
                  {passError && <div className="pass-message">{passError}</div>}
                  {pass && <div className="pass-result"><span>NEXT PASS ABOVE MASK</span><strong>{pass.aos.toLocaleString()}</strong><small>Rise · local time</small><strong>{pass.los.toLocaleString()}</strong><small>Set · local time · maximum elevation {pass.maxElevationDeg.toFixed(1)}°</small></div>}
                </div>
              )}
              {panel === 'about' && <div className="detail-note"><Database size={14} /><p>Owner code <b>{selected.record.OWNER}</b> and payload type are taken from the matched CelesTrak SATCAT record. Orbit elements are from the CelesTrak GP/OMM feed.</p></div>}
            </>
          ) : <div className="select-prompt"><div className="prompt-icon"><Satellite size={23} /></div><strong>Choose an Indian spacecraft</strong><span>Select one from the list or click its marker on the globe to inspect its current modelled position and orbit.</span></div>}
          <div className="data-links"><div className="eyebrow">PUBLIC MISSION DATA</div><a href="https://bhoonidhi.nrsc.gov.in/" target="_blank" rel="noreferrer">Bhoonidhi earth-observation archive <ArrowUpRight size={13} /></a><a href="https://www.isro.gov.in/Sciencedata.html" target="_blank" rel="noreferrer">ISRO science data archives <ArrowUpRight size={13} /></a></div>
        </aside>
      </main>

      <footer className="app-footer">
        <div><span className="footer-led" /><span>{loadState === 'online' ? 'PUBLIC CATALOG CHECKED' : loadState === 'bundled' ? 'PACKAGED DATA' : loadState.toUpperCase()}</span><span className="footer-separator">·</span><span>{lastCheck ? formatUtc(lastCheck) : 'Waiting for first check'}</span></div>
        <div>{manifest ? `${manifest.total_objects} Indian payload records · ${dataIsStale ? 'snapshot stale' : `snapshot ${timeAgeLabel(manifestAgeMs)}`}` : 'No catalog snapshot loaded'}</div>
        <a href="https://celestrak.org/NORAD/documentation/gp-data-formats.php" target="_blank" rel="noreferrer">Data source <ChevronRight size={12} /></a>
      </footer>
    </div>
  );
}
