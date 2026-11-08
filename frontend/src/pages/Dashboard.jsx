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
  LabelList,

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

const EARTH_RADIUS_KM = 6378.137;





export const Dashboard = () => {

  const analytics = useOrbitStore((state) => state.analytics);

  const fetchAnalytics = useOrbitStore((state) => state.fetchAnalytics);

  const fetchInitialData = useOrbitStore((state) => state.fetchInitialData);

  const satellites = useOrbitStore((state) => state.satellites);

  const debris = useOrbitStore((state) => state.debris);

  const catalog = useOrbitStore((state) => state.catalog);

  const selectSatellite = useOrbitStore((state) => state.selectSatellite);

  const navigate = useNavigate();



  const [searchQuery, setSearchQuery] = useState('');
  const [isroOnly, setIsroOnly] = useState(true);



  useEffect(() => {

    fetchAnalytics();
    if (!catalog || catalog.length === 0) {
      fetchInitialData();
    }

  }, [fetchAnalytics, fetchInitialData, catalog]);



  const isroSatellites = useMemo(() => {
    const pool = catalog && catalog.length > 0 ? catalog : satellites;
    return pool.filter((s) => s.object_type === 'Satellite' && (s.is_isro || (s.country || '').toLowerCase().includes('india')));
  }, [catalog, satellites]);

  const allSatellites = useMemo(() => {
    const pool = catalog && catalog.length > 0 ? catalog : satellites;
    return pool.filter((s) => s.object_type === 'Satellite');
  }, [catalog, satellites]);

  const allDebris = useMemo(() => {
    const pool = catalog && catalog.length > 0 ? catalog : debris;
    const filtered = pool.filter((s) => s.object_type === 'Debris');
    return filtered;
  }, [catalog, debris]);

  const allUnknown = useMemo(() => {
    const pool = catalog && catalog.length > 0 ? catalog : [...satellites, ...debris];
    return pool.filter((s) => s.object_type === 'Unknown');
  }, [catalog, satellites, debris]);

  const isroDebris = useMemo(() => {
    return allDebris.filter(
      (d) =>
        d.is_isro ||
        (d.country || '').toLowerCase().includes('india')
    );
  }, [allDebris]);

  const isroUnknown = allUnknown.filter((item) => item.is_isro || (item.country || '').toLowerCase().includes('india'));
  const totalTracked = isroOnly
    ? isroSatellites.length + isroDebris.length + isroUnknown.length
    : (catalog?.length || allSatellites.length + allDebris.length + allUnknown.length);
  const activeCount = isroOnly ? isroSatellites.length : allSatellites.length;
  const debrisCount = isroOnly ? isroDebris.length : allDebris.length;

  const meanVelocity = useMemo(() => {
    const pool = isroOnly ? isroSatellites : allSatellites;
    const leoObjects = pool.filter((s) => {
      const alt = s.alt_km ?? s.altitude;
      return alt !== undefined && alt > 150 && alt <= 2000;
    });
    const velocities = leoObjects.map((s) => Number(s.velocity_km_s)).filter(Number.isFinite);
    if (!velocities.length) return null;
    return (velocities.reduce((sum, value) => sum + value, 0) / velocities.length).toFixed(2);
  }, [isroOnly, isroSatellites, allSatellites]);

  const typeBreakdown = useMemo(() => {
    if (isroOnly) {
      return [
        { name: 'Active ISRO Payloads', value: isroSatellites.length, color: '#10b981' },
        { name: 'Monitored Debris Hazards', value: isroDebris.length, color: '#ef4444' },
        ...(isroUnknown.length ? [{ name: 'Unclassified Catalog Objects', value: isroUnknown.length, color: '#94a3b8' }] : []),
      ];
    }
    return [
      { name: 'Operational Satellites', value: allSatellites.length, color: '#10b981' },
      { name: 'Space Debris & Fragments', value: allDebris.length, color: '#ef4444' },
      ...(allUnknown.length ? [{ name: 'Unclassified Catalog Objects', value: allUnknown.length, color: '#94a3b8' }] : []),
    ];
  }, [isroOnly, isroSatellites, allSatellites, allDebris, isroDebris]);

  const altHistogram = useMemo(() => {
    const pool = isroOnly ? isroSatellites : (catalog && catalog.length > 0 ? catalog : satellites);
    const bins = [
      { range: '200-500 km', count: 0 },
      { range: '500-700 km', count: 0 },
      { range: '700-1000 km', count: 0 },
      { range: '1000-2000 km', count: 0 },
      { range: 'MEO (2-35k)', count: 0 },
      { range: 'GEO (~36k km)', count: 0 },
    ];

    if (!pool || pool.length === 0) {
      return [
        ...bins,
      ];
    }

    for (const s of pool) {
      let alt;
      if (s.semi_major_axis_km) {
        alt = s.semi_major_axis_km - EARTH_RADIUS_KM;
      } else if (Number.isFinite(s.perigee_km)) {
        alt = s.perigee_km;
      } else if (Number.isFinite(s.alt_km)) {
        alt = s.alt_km;
      } else {
        continue;
      }

      if (alt < 500) bins[0].count++;
      else if (alt < 700) bins[1].count++;
      else if (alt < 1000) bins[2].count++;
      else if (alt < 2000) bins[3].count++;
      else if (alt < 35000) bins[4].count++;
      else bins[5].count++;
    }

    return bins;
  }, [isroOnly, isroSatellites, catalog, satellites]);




  // Filter launch records for the current calendar year.

  const targetYear = new Date().getFullYear();



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



    return found.sort((a, b) => (b.intl_des || '').localeCompare(a.intl_des || ''));

  }, [catalog, satellites, targetYear]);



  const filteredLaunchedSats = useMemo(() => {

    let list = launchedThisYear;
    if (isroOnly) {
      list = list.filter((s) => s.is_isro || (s.country || '').toLowerCase().includes('india'));
    }
    if (!searchQuery.trim()) return list;

    const q = searchQuery.toLowerCase().trim();

    return list.filter(

      (s) =>

        (s.name || '').toLowerCase().includes(q) ||

        String(s.norad_id || '').includes(q) ||

        (s.intl_des || '').toLowerCase().includes(q) ||

        (s.country || '').toLowerCase().includes(q) ||

        (s.regime || '').toLowerCase().includes(q)

    );

  }, [launchedThisYear, isroOnly, searchQuery]);



  return (

    <div className="w-full bg-space-950 p-4 md:p-6 text-slate-100 space-y-6">

      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between pb-4 border-b border-cyan-500/20 gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-extrabold tracking-tight bg-gradient-to-r from-cyan-400 via-sky-300 to-emerald-400 bg-clip-text text-transparent">
            Orbital Situational Awareness & Debris Risk Analytics
          </h1>
        </div>

        <div className="flex items-center gap-2.5">
          {/* The page refreshes API state periodically; source time is shown in the banner. */}
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-emerald-950/60 border border-emerald-500/40 text-emerald-300 font-bold font-mono text-xs shadow-glow-emerald">
            <span className="w-2 h-2 rounded-full bg-cyan-400" />
            <span>Dashboard refresh: 20s</span>
          </div>

          {/* ISRO Filter Toggle */}
          <button
            onClick={() => setIsroOnly(!isroOnly)}
            className={`px-3 py-1.5 rounded-lg border font-mono text-xs font-bold transition flex items-center gap-1.5 ${
              isroOnly
                ? 'bg-amber-500/20 border-amber-400 text-amber-300 shadow-glow-amber'
                : 'bg-space-900 border-slate-700 text-slate-400 hover:text-slate-200'
            }`}
          >
            {isroOnly ? 'ISRO Assets Only' : 'Showing All Assets'}
          </button>
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
            {totalTracked.toLocaleString()}
          </div>
          <div className="text-[11px] text-cyan-400 font-mono mt-1">
            {isroOnly ? 'Cataloged ISRO in Orbit' : 'Cataloged in Orbit'}
          </div>
        </div>

        <div className="glass-panel rounded-xl p-4 shadow-xl border-l-4 border-l-emerald-500">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-1 font-mono">
            <span>Operational Satellites</span>
            <Satellite className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl md:text-3xl font-mono font-bold text-emerald-300">
            {activeCount.toLocaleString()}
          </div>
          <div className="text-[11px] text-emerald-400 font-mono mt-1">
            {isroOnly ? 'Active ISRO Spacecraft' : 'Active Spacecraft'}
          </div>
        </div>

        <div className="glass-panel rounded-xl p-4 shadow-xl border-l-4 border-l-rose-500">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-1 font-mono">
            <span>Cataloged Debris & R/B</span>
            <ShieldAlert className="w-4 h-4 text-rose-500" />
          </div>
          <div className="text-2xl md:text-3xl font-mono font-bold text-rose-400">
            {debrisCount.toLocaleString()}
          </div>
          <div className="text-[11px] text-rose-400 font-mono mt-1">
            {isroOnly ? 'Monitored Hazard Debris' : 'Collisional Hazard'}
          </div>
        </div>

        <div className="glass-panel rounded-xl p-4 shadow-xl border-l-4 border-l-amber-500">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-1 font-mono">
            <span>Mean Velocity (LEO)</span>
            <TrendingUp className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl md:text-3xl font-mono font-bold text-amber-300">
            {meanVelocity == null ? 'Unavailable' : `${meanVelocity} km/s`}
          </div>
          <div className="text-[11px] text-amber-400 font-mono mt-1">Mean Orbital Speed (LEO)</div>
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

                  cursor={{ fill: 'rgba(34, 211, 238, 0.08)' }}

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
              <BarChart data={altHistogram} margin={{ top: 20, right: 10, left: -15, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis
                  dataKey="range"
                  stroke="#94a3b8"
                  tick={{ fontSize: 10, fontFamily: 'monospace' }}
                  angle={-15}
                  textAnchor="end"
                />
                <YAxis
                  stroke="#94a3b8"
                  tick={{ fontSize: 11, fontFamily: 'monospace' }}
                  domain={[0, (dataMax) => Math.max(10, Math.ceil(dataMax * 1.25))]}
                />
                <Tooltip
                  cursor={{ fill: 'rgba(56, 189, 248, 0.08)' }}
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
                <Bar dataKey="count" fill="#38bdf8" radius={[4, 4, 0, 0]}>
                  <LabelList
                    dataKey="count"
                    position="top"
                    fill="#38bdf8"
                    fontSize={11}
                    fontWeight="bold"
                    fontFamily="monospace"
                    formatter={(val) => Number(val).toLocaleString()}
                  />
                </Bar>
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

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setIsroOnly(!isroOnly)}
                className={`px-2 py-1 text-[11px] font-mono font-bold rounded border transition ${
                  isroOnly
                    ? 'bg-amber-500/20 border-amber-400 text-amber-300'
                    : 'bg-space-950/80 border-slate-700 text-slate-400 hover:text-white'
                }`}
              >
                {isroOnly ? 'ISRO Assets Only' : 'Showing All'}
              </button>

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

      <DebrisStats isroOnly={isroOnly} />



      {/* Feature 5: Ground Station Pass Predictor */}

      <PassPredictor />

    </div>

  );

};



export default Dashboard;

