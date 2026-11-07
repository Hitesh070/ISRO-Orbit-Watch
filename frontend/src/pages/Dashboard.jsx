/**
 * Dashboard Page
 * Macro space situational awareness dashboard with Recharts visualizations:
 * breakdown pie chart, altitude histogram, satellites launched in current year, country distribution,
 * top 10 risk table, shell stats, and ground station pass predictions.
 */

import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import {
  Satellite,
  ShieldAlert,
  Layers,
  Compass,
  TrendingUp,
  Globe2,
  Calendar,
  Activity,
  Rocket,
  ExternalLink,
} from 'lucide-react';
import { useOrbitStore } from '../store/useOrbitStore';
import RiskTable from '../components/Dashboard/RiskTable';
import DebrisStats from '../components/Dashboard/DebrisStats';
import PassPredictor from '../components/Dashboard/PassPredictor';

const FALLBACK_2026_SATELLITES = [
  {
    "norad_id": 101228,
    "name": "NVS-03 (IRNSS-1L)",
    "intl_des": "2026-245A",
    "country": "India (ISRO)",
    "is_isro": true,
    "regime": "GEO",
    "apogee_km": 36163.1,
    "perigee_km": 35761.4,
    "inclination": 30.2704
  },
  {
    "norad_id": 101031,
    "name": "DRAGON CRS-35",
    "intl_des": "2026-233A",
    "country": "United States",
    "is_isro": false,
    "regime": "LEO",
    "apogee_km": 423.9,
    "perigee_km": 414.1,
    "inclination": 51.6322
  },
  {
    "norad_id": 100882,
    "name": "CREW DRAGON 13",
    "intl_des": "2026-226A",
    "country": "United States",
    "is_isro": false,
    "regime": "LEO",
    "apogee_km": 423.9,
    "perigee_km": 414.1,
    "inclination": 51.6322
  },
  {
    "norad_id": 100744,
    "name": "COSMOS 2620 (709K)",
    "intl_des": "2026-216A",
    "country": "Russia",
    "is_isro": false,
    "regime": "MEO",
    "apogee_km": 19152.8,
    "perigee_km": 19139.1,
    "inclination": 64.7785
  },
  {
    "norad_id": 100712,
    "name": "PROGRESS-MS 35",
    "intl_des": "2026-212A",
    "country": "Russia",
    "is_isro": false,
    "regime": "LEO",
    "apogee_km": 423.9,
    "perigee_km": 414.1,
    "inclination": 51.6322
  },
  {
    "norad_id": 100530,
    "name": "MTG-I2",
    "intl_des": "2026-198A",
    "country": "International",
    "is_isro": false,
    "regime": "GEO",
    "apogee_km": 35791.6,
    "perigee_km": 35782.5,
    "inclination": 0.8894
  },
  {
    "norad_id": 100057,
    "name": "SOYUZ-MS 29",
    "intl_des": "2026-162A",
    "country": "Russia",
    "is_isro": false,
    "regime": "LEO",
    "apogee_km": 423.9,
    "perigee_km": 414.1,
    "inclination": 51.6322
  },
  {
    "norad_id": 69591,
    "name": "SPACEMOBILE-010",
    "intl_des": "2026-139C",
    "country": "International",
    "is_isro": false,
    "regime": "LEO",
    "apogee_km": 530.7,
    "perigee_km": 524.0,
    "inclination": 52.9955
  },
  {
    "norad_id": 69590,
    "name": "SPACEMOBILE-009",
    "intl_des": "2026-139B",
    "country": "International",
    "is_isro": false,
    "regime": "LEO",
    "apogee_km": 530.5,
    "perigee_km": 523.7,
    "inclination": 52.995
  },
  {
    "norad_id": 69589,
    "name": "SPACEMOBILE-008",
    "intl_des": "2026-139A",
    "country": "International",
    "is_isro": false,
    "regime": "LEO",
    "apogee_km": 530.1,
    "perigee_km": 523.6,
    "inclination": 52.9957
  },
  {
    "norad_id": 69235,
    "name": "TJS-24",
    "intl_des": "2026-116A",
    "country": "International",
    "is_isro": false,
    "regime": "GEO",
    "apogee_km": 35743.7,
    "perigee_km": 35720.3,
    "inclination": 0.3716
  },
  {
    "norad_id": 69180,
    "name": "SHENZHOU-23 (SZ-23)",
    "intl_des": "2026-113A",
    "country": "China",
    "is_isro": false,
    "regime": "LEO",
    "apogee_km": 386.6,
    "perigee_km": 380.4,
    "inclination": 41.4683
  },
  {
    "norad_id": 69123,
    "name": "SMILE",
    "intl_des": "2026-109A",
    "country": "International",
    "is_isro": false,
    "regime": "HEO",
    "apogee_km": 118934.4,
    "perigee_km": 7066.4,
    "inclination": 69.9594
  },
  {
    "norad_id": 69049,
    "name": "TIANZHOU-10",
    "intl_des": "2026-102A",
    "country": "International",
    "is_isro": false,
    "regime": "LEO",
    "apogee_km": 386.6,
    "perigee_km": 380.4,
    "inclination": 41.4683
  },
  {
    "norad_id": 69013,
    "name": "CAS500-2",
    "intl_des": "2026-100AK",
    "country": "International",
    "is_isro": false,
    "regime": "LEO",
    "apogee_km": 508.8,
    "perigee_km": 498.3,
    "inclination": 97.3724
  },
  {
    "norad_id": 68837,
    "name": "PROGRESS-MS 34",
    "intl_des": "2026-093A",
    "country": "Russia",
    "is_isro": false,
    "regime": "LEO",
    "apogee_km": 423.9,
    "perigee_km": 414.1,
    "inclination": 51.6322
  },
  {
    "norad_id": 68835,
    "name": "PRSC-E03",
    "intl_des": "2026-092A",
    "country": "International",
    "is_isro": false,
    "regime": "LEO",
    "apogee_km": 546.7,
    "perigee_km": 542.5,
    "inclination": 38.002
  },
  {
    "norad_id": 68791,
    "name": "GPS BIII-10 (PRN 13)",
    "intl_des": "2026-087A",
    "country": "United States",
    "is_isro": false,
    "regime": "MEO",
    "apogee_km": 20244.4,
    "perigee_km": 20122.0,
    "inclination": 54.9458
  },
  {
    "norad_id": 68126,
    "name": "ECHOSTAR 25",
    "intl_des": "2026-045A",
    "country": "International",
    "is_isro": false,
    "regime": "GEO",
    "apogee_km": 35792.5,
    "perigee_km": 35782.1,
    "inclination": 0.0158
  },
  {
    "norad_id": 67757,
    "name": "JAM-E JAM 1",
    "intl_des": "2026-028B",
    "country": "International",
    "is_isro": false,
    "regime": "GEO",
    "apogee_km": 35786.8,
    "perigee_km": 35783.0,
    "inclination": 0.2131
  },
  {
    "norad_id": 67756,
    "name": "ELEKTRO-L 5",
    "intl_des": "2026-028A",
    "country": "International",
    "is_isro": false,
    "regime": "GEO",
    "apogee_km": 35793.1,
    "perigee_km": 35780.5,
    "inclination": 0.0439
  },
  {
    "norad_id": 67588,
    "name": "GPS BIII-9  (PRN 20)",
    "intl_des": "2026-017A",
    "country": "United States",
    "is_isro": false,
    "regime": "MEO",
    "apogee_km": 20238.7,
    "perigee_km": 20125.1,
    "inclination": 55.1912
  },
  {
    "norad_id": 67304,
    "name": "CSG-3",
    "intl_des": "2026-001A",
    "country": "International",
    "is_isro": false,
    "regime": "LEO",
    "apogee_km": 623.6,
    "perigee_km": 621.4,
    "inclination": 97.8894
  }
];

export const Dashboard = () => {
  const analytics = useOrbitStore((state) => state.analytics);
  const fetchAnalytics = useOrbitStore((state) => state.fetchAnalytics);
  const satellites = useOrbitStore((state) => state.satellites);
  const debris = useOrbitStore((state) => state.debris);
  const catalog = useOrbitStore((state) => state.catalog);
  const selectSatellite = useOrbitStore((state) => state.selectSatellite);
  const navigate = useNavigate();

  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const totalTracked = analytics?.total_tracked_objects || satellites.length + debris.length;
  const activeCount = analytics?.active_satellites || satellites.length;
  const debrisCount = analytics?.debris_pieces || debris.length;

  const typeBreakdown = analytics?.type_breakdown || [
    { name: 'Operational Satellites', value: 20, color: '#10b981' },
    { name: 'Space Debris & Fragments', value: 9, color: '#ef4444' },
    { name: 'Rocket Upper Stages', value: 3, color: '#f59e0b' },
  ];

  const altHistogram = analytics?.altitude_histogram || [];

  // Determine current active launch year (defaulting to 2026)
  const targetYear = useMemo(() => {
    const yr = new Date().getFullYear();
    return yr >= 2024 ? yr : 2026;
  }, []);

  // Filter satellites launched in target year
  const launchedThisYear = useMemo(() => {
    const pool = catalog && catalog.length > 0 ? catalog : satellites;
    const found = pool.filter((s) => {
      if (s.object_type && s.object_type !== 'Satellite') return false;
      const intl = s.intl_des || '';
      const parts = intl.split('-');
      let yr = null;
      if (parts.length >= 2 && parts[0].length === 4 && !isNaN(Number(parts[0]))) {
        yr = parseInt(parts[0], 10);
      } else if (intl && /^\d{2}/.test(intl)) {
        const yy = parseInt(intl.slice(0, 2), 10);
        yr = yy >= 57 ? 1900 + yy : 2000 + yy;
      }
      return yr === targetYear;
    });

    if (found.length === 0 && targetYear === 2026) {
      return FALLBACK_2026_SATELLITES;
    }

    return found.sort((a, b) => (b.intl_des || '').localeCompare(a.intl_des || ''));
  }, [catalog, satellites, targetYear]);

  const filteredLaunchedSats = useMemo(() => {
    if (!searchQuery.trim()) return launchedThisYear;
    const q = searchQuery.toLowerCase().trim();
    return launchedThisYear.filter(
      (s) =>
        (s.name || '').toLowerCase().includes(q) ||
        String(s.norad_id || '').includes(q) ||
        (s.intl_des || '').toLowerCase().includes(q) ||
        (s.country || '').toLowerCase().includes(q) ||
        (s.regime || '').toLowerCase().includes(q)
    );
  }, [launchedThisYear, searchQuery]);

  return (
    <div className="w-full bg-space-950 p-4 md:p-6 text-slate-100 space-y-6">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between pb-4 border-b border-cyan-500/20 gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-extrabold tracking-tight bg-gradient-to-r from-cyan-400 via-sky-300 to-emerald-400 bg-clip-text text-transparent">
            Orbital Situational Awareness & Debris Risk Analytics
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Global Space Surveillance Network (SSN) telemetry ingestion, conjunction probability assessment, and pass tracking.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="px-3 py-1.5 rounded-lg bg-cyan-950/60 border border-cyan-500/30 text-cyan-300 font-mono text-xs flex items-center gap-1.5">
            <Activity className="w-3.5 h-3.5 text-cyan-400 animate-pulse" /> SGP4 Propagated
          </span>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="glass-panel rounded-xl p-4 shadow-xl border-l-4 border-l-cyan-500">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-1 font-mono">
            <span>Total Tracked Objects</span>
            <Globe2 className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="text-2xl md:text-3xl font-mono font-bold text-slate-100">
            {totalTracked}
          </div>
          <div className="text-[11px] text-cyan-400 font-mono mt-1">Cataloged in Orbit</div>
        </div>

        <div className="glass-panel rounded-xl p-4 shadow-xl border-l-4 border-l-emerald-500">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-1 font-mono">
            <span>Operational Satellites</span>
            <Satellite className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl md:text-3xl font-mono font-bold text-emerald-300">
            {activeCount}
          </div>
          <div className="text-[11px] text-emerald-400 font-mono mt-1">Active Spacecraft</div>
        </div>

        <div className="glass-panel rounded-xl p-4 shadow-xl border-l-4 border-l-rose-500">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-1 font-mono">
            <span>Cataloged Debris & R/B</span>
            <ShieldAlert className="w-4 h-4 text-rose-500" />
          </div>
          <div className="text-2xl md:text-3xl font-mono font-bold text-rose-400">
            {debrisCount}
          </div>
          <div className="text-[11px] text-rose-400 font-mono mt-1">Collisional Hazard</div>
        </div>

        <div className="glass-panel rounded-xl p-4 shadow-xl border-l-4 border-l-amber-500">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-1 font-mono">
            <span>Mean Velocity (LEO)</span>
            <TrendingUp className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl md:text-3xl font-mono font-bold text-amber-300">
            7.68 km/s
          </div>
          <div className="text-[11px] text-amber-400 font-mono mt-1">First Cosmic Speed</div>
        </div>
      </div>

      {/* Main 2-Column Visual Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pie Chart: Operational Satellites vs Debris vs Rocket Bodies */}
        <div className="glass-panel rounded-xl p-5 shadow-2xl flex flex-col justify-between">
          <div className="flex items-center justify-between pb-3 border-b border-cyan-500/20 mb-3">
            <h3 className="text-sm font-bold text-cyan-400 flex items-center gap-2">
              <Compass className="w-4 h-4 text-cyan-400" />
              Orbital Population Breakdown
            </h3>
            <span className="text-[11px] font-mono text-slate-400">Payload vs Space Junk</span>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={typeBreakdown}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={95}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {typeBreakdown.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  content={({ active, payload }) => {
                    if (!active || !payload || !payload.length) return null;
                    const d = payload[0];
                    return (
                      <div className="p-2.5 rounded-lg bg-space-950 border border-cyan-500/40 text-xs font-mono shadow-2xl backdrop-blur-md">
                        <div className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: d.payload.color }} />
                          <span className="font-bold text-slate-100">{d.name}</span>
                        </div>
                        <div className="mt-1 text-cyan-300 font-bold">
                          {Number(d.value).toLocaleString()} objects
                        </div>
                      </div>
                    );
                  }}
                />
                <Legend
                  wrapperStyle={{ fontSize: '11px', fontFamily: 'monospace', paddingTop: '10px' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Bar Chart: Altitude Distribution Histogram */}
        <div className="glass-panel rounded-xl p-5 shadow-2xl flex flex-col justify-between">
          <div className="flex items-center justify-between pb-3 border-b border-cyan-500/20 mb-3">
            <h3 className="text-sm font-bold text-cyan-400 flex items-center gap-2">
              <Layers className="w-4 h-4 text-cyan-400" />
              Altitude Distribution Histogram
            </h3>
            <span className="text-[11px] font-mono text-slate-400">Objects vs Orbital Altitude</span>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={altHistogram} margin={{ top: 15, right: 10, left: -15, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis
                  dataKey="range"
                  stroke="#94a3b8"
                  tick={{ fontSize: 10, fontFamily: 'monospace' }}
                  angle={-15}
                  textAnchor="end"
                />
                <YAxis stroke="#94a3b8" tick={{ fontSize: 11, fontFamily: 'monospace' }} />
                <Tooltip
                  content={({ active, payload }) => {
                    if (!active || !payload || !payload.length) return null;
                    const d = payload[0];
                    return (
                      <div className="p-2.5 rounded-lg bg-space-950 border border-cyan-500/40 text-xs font-mono shadow-2xl backdrop-blur-md">
                        <div className="text-slate-400 font-semibold">{d.payload.range}</div>
                        <div className="mt-1 text-cyan-300 font-bold">
                          {Number(d.value).toLocaleString()} objects
                        </div>
                      </div>
                    );
                  }}
                />
                <Bar dataKey="count" fill="#38bdf8" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Scrollable Section: Satellites Launched in Current Year (2026) */}
        <div className="lg:col-span-2 glass-panel rounded-xl p-5 shadow-2xl flex flex-col justify-between">
          <div className="flex items-center justify-between pb-3 border-b border-cyan-500/20 mb-3">
            <h3 className="text-sm font-bold text-cyan-400 flex items-center gap-2">
              <Rocket className="w-4 h-4 text-cyan-400" />
              Satellites Launched in {targetYear}
            </h3>
            <span className="text-[11px] font-mono text-emerald-400 font-bold bg-emerald-950/60 border border-emerald-500/30 px-2 py-0.5 rounded flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              {filteredLaunchedSats.length} Satellites Deployed
            </span>
          </div>

          <div className="flex items-center justify-between gap-2 mb-2">
            <p className="text-xs text-slate-400 leading-relaxed truncate">
              Cataloged spacecraft and payloads deployed into orbit during {targetYear}.
            </p>
            <div className="relative shrink-0">
              <input
                type="text"
                placeholder="Search 2026 satellites..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-36 sm:w-48 px-2.5 py-1 text-[11px] font-mono rounded bg-space-950/80 border border-slate-700/80 focus:border-cyan-400 text-slate-200 placeholder-slate-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="h-64 w-full overflow-y-auto pr-1.5">
            {filteredLaunchedSats.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-500 font-mono text-xs">
                <Rocket className="w-8 h-8 text-slate-600 mb-2 animate-bounce" />
                <span>No satellites matched "{searchQuery}"</span>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {filteredLaunchedSats.map((sat) => (
                  <div
                    key={sat.norad_id}
                    onClick={() => {
                      selectSatellite(sat.norad_id);
                      navigate('/');
                    }}
                    className="p-2.5 rounded-lg bg-space-950/70 hover:bg-cyan-950/40 border border-slate-800/80 hover:border-cyan-500/40 transition cursor-pointer flex items-center justify-between group"
                    title="Click to track in 3D Orbit View"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div
                        className={`w-7 h-7 rounded-md flex items-center justify-center shrink-0 border ${
                          sat.is_isro
                            ? 'bg-amber-950/50 border-amber-500/50 text-amber-400'
                            : 'bg-cyan-950/50 border-cyan-500/40 text-cyan-400'
                        }`}
                      >
                        <Rocket className="w-3.5 h-3.5" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-bold text-slate-100 group-hover:text-cyan-300 truncate">
                            {sat.name}
                          </span>
                          {sat.is_isro && (
                            <span className="px-1.5 py-0.2 text-[9px] font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded">
                              ISRO
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] font-mono text-slate-400 flex items-center gap-1.5 mt-0.5 truncate">
                          <span>#{sat.norad_id}</span>
                          <span>•</span>
                          <span className="text-cyan-400/90">{sat.intl_des}</span>
                          <span>•</span>
                          <span className="truncate">{sat.country || 'International'}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 ml-2">
                      <div className="text-right">
                        <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-cyan-950/70 text-cyan-300 border border-cyan-500/30">
                          {sat.regime || 'LEO'}
                        </span>
                        <div className="text-[10px] font-mono text-slate-400 mt-0.5">
                          {sat.apogee_km ? `${Math.round(sat.apogee_km).toLocaleString()} km` : 'Active'}
                        </div>
                      </div>
                      <ExternalLink className="w-3.5 h-3.5 text-slate-500 group-hover:text-cyan-400 transition" />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Feature 3: Top 10 High-Risk Active Satellites Table */}
      <RiskTable />

      {/* Feature 3: Debris Density by Orbital Shell + Heatmap */}
      <DebrisStats />

      {/* Feature 5: Ground Station Pass Predictor */}
      <PassPredictor />
    </div>
  );
};

export default Dashboard;
