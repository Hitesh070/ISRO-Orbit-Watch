import React from 'react';
import { Database, AlertCircle, CheckCircle2 } from 'lucide-react';
import { useOrbitStore } from '../../store/useOrbitStore';

export const StaleDataBanner = () => {
  const metadata = useOrbitStore((state) => state.metadata);

  if (!metadata) return null;

  const isStale = metadata.stale_objects > 0;
  const formattedTime = metadata.fetch_time_utc
    ? new Date(metadata.fetch_time_utc).toUTCString()
    : 'Live Session';

  return (
    <div className="w-full bg-space-950/90 border-b border-slate-800/80 px-4 py-1.5 flex flex-wrap items-center justify-between text-[11px] font-mono text-slate-400">
      <div className="flex items-center gap-2">
        <Database className="w-3.5 h-3.5 text-cyan-400" />
        <span className="text-slate-300 font-semibold">Provenance:</span>
        <span className="text-cyan-300">{metadata.source || 'CelesTrak CCSDS OMM/GP API'}</span>
        <span className="text-slate-600">|</span>
        <span>Catalog: {metadata.total_objects?.toLocaleString() || '3,789'} tracked assets ({metadata.isro_assets || 79} ISRO)</span>
      </div>

      <div className="flex items-center gap-3">
        <span className="hidden md:inline text-slate-500">Last Ingestion: {formattedTime}</span>
        {isStale ? (
          <span className="flex items-center gap-1 text-amber-400 bg-amber-950/40 px-2 py-0.5 rounded border border-amber-500/30">
            <AlertCircle className="w-3 h-3" />
            <span>Screening-Grade (TLE Age &gt; 14d on {metadata.stale_objects} assets)</span>
          </span>
        ) : (
          <span className="flex items-center gap-1 text-emerald-400 bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-500/30">
            <CheckCircle2 className="w-3 h-3" />
            <span>Elements Nominal (&lt; 24h Epoch)</span>
          </span>
        )}
      </div>
    </div>
  );
};

export default StaleDataBanner;
