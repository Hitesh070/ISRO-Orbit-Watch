import React from 'react';
import { useOrbitStore } from '../../store/useOrbitStore';

export const StaleDataBanner = () => {
  const metadata = useOrbitStore((state) => state.metadata);
  const conjunctionsScreenTime = useOrbitStore((state) => state.conjunctionsScreenTime);
  const conjunctionsScreenScope = useOrbitStore((state) => state.conjunctionsScreenScope);
  const [now, setNow] = React.useState(Date.now());

  React.useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(timer);
  }, []);

  const sourceTimestamp = metadata?.fetch_time_utc || metadata?.fetchTime;
  const sourceTime = sourceTimestamp ? Date.parse(sourceTimestamp) : Number.NaN;
  const ageMs = Number.isFinite(sourceTime) ? Math.max(0, now - sourceTime) : null;
  const stale = ageMs !== null && ageMs > 6 * 60 * 60 * 1000;
  const formattedTime = ageMs === null
    ? 'Catalog freshness unavailable'
    : `Catalog generated ${new Date(sourceTime).toISOString().replace('T', ' ').slice(0, 19)} UTC`;
  const catalogSource = metadata?.source ? ` • Source: ${metadata.source}` : '';
  const excludedUnsupportedIds = Number(metadata?.excluded_unsupported_norad_ids || 0);
  const unclassifiedObjects = Number(metadata?.unclassified_objects || 0);
  const conjunctionTime = conjunctionsScreenTime && Number.isFinite(Date.parse(conjunctionsScreenTime))
    ? `Conjunction screen generated ${new Date(conjunctionsScreenTime).toISOString().replace('T', ' ').slice(0, 19)} UTC`
    : 'Conjunction screen time unavailable';
  const conjunctionAgeMs = conjunctionsScreenTime && Number.isFinite(Date.parse(conjunctionsScreenTime))
    ? Math.max(0, now - Date.parse(conjunctionsScreenTime))
    : null;
  const conjunctionStale = conjunctionAgeMs !== null && conjunctionAgeMs > 6 * 60 * 60 * 1000;
  const coverageText = conjunctionsScreenScope
    ? `Screen coverage: ${conjunctionsScreenScope.target_satellites_screened ?? 'unknown'} of ${conjunctionsScreenScope.target_satellites_total ?? 'unknown'} target satellites; ${conjunctionsScreenScope.debris_objects_screened ?? 'unknown'} debris objects`
    : 'Screening coverage unavailable';

  return (
    <div className={`px-3 py-2 text-[11px] font-mono border-b ${stale || conjunctionStale || ageMs === null || conjunctionAgeMs === null ? 'bg-amber-950/70 border-amber-500/40 text-amber-200' : 'bg-slate-900/80 border-slate-700 text-slate-300'}`} role="status">
      <span>{formattedTime}{stale ? ' • Snapshot is older than 6 hours' : ''}{catalogSource}</span>
      <span className="ml-2">{conjunctionTime}{conjunctionStale ? ' • Screen is older than 6 hours' : ''}</span>
      <span className="ml-2">{coverageText}</span>
      {excludedUnsupportedIds > 0 && <span className="ml-2">{excludedUnsupportedIds} records omitted because their NORAD IDs cannot be represented by the current TLE propagator.</span>}
      {unclassifiedObjects > 0 && <span className="ml-2">{unclassifiedObjects} catalog records have no verified object type or owner classification.</span>}
      <span className="ml-2">Orbit positions are SGP4 predictions from catalog elements, not live sensor telemetry.</span>
    </div>
  );
};

export default StaleDataBanner;
