/**
 * Dashboard Page
 * Macro space situational awareness dashboard with Recharts visualizations:
 * breakdown pie chart, altitude histogram, historical launch trend, country distribution,
 * top 10 risk table, shell stats, and ground station pass predictions.
 */

import React, { useEffect } from 'react';
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
} from 'lucide-react';
import { useOrbitStore } from '../store/useOrbitStore';
import RiskTable from '../components/Dashboard/RiskTable';
import DebrisStats from '../components/Dashboard/DebrisStats';
import PassPredictor from '../components/Dashboard/PassPredictor';

export const Dashboard = () => {
  const analytics = useOrbitStore((state) => state.analytics);
  const fetchAnalytics = useOrbitStore((state) => state.fetchAnalytics);
  const satellites = useOrbitStore((state) => state.satellites);
  const debris = useOrbitStore((state) => state.debris);

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
  const countryDist = analytics?.country_distribution || [];
  const launchTrend = analytics?.launch_trend || [];

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
            7.66 <span className="text-sm font-normal text-slate-400">km/s</span>
          </div>
          <div className="text-[11px] text-amber-400 font-mono mt-1">27,576 km/h Orbital Speed</div>
        </div>
      </div>

      {/* Feature 3: Top 10 High-Risk Active Satellites Table */}
      <RiskTable />

      {/* Feature 3: Debris Density by Orbital Shell + Heatmap */}
      <DebrisStats />

      {/* Feature 6: Macro Analytics Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
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

        {/* Bar Chart: Historical Launch Year Trend (1957 - Present) */}
        <div className="glass-panel rounded-xl p-5 shadow-2xl flex flex-col justify-between">
          <div className="flex items-center justify-between pb-3 border-b border-cyan-500/20 mb-3">
            <h3 className="text-sm font-bold text-cyan-400 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-cyan-400" />
              Space Age Launch Growth & Mega-Constellation Era
            </h3>
            <span className="text-[11px] font-mono text-slate-400">1960 — 2026</span>
          </div>

          <p className="text-xs text-slate-400 mb-2 leading-relaxed">
            Exponential growth driven by commercial rideshares, Starlink/OneWeb LEO constellations,
            and ASAT fragmentation spikes (2007 Fengyun-1C and 2009 Cosmos/Iridium).
          </p>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={launchTrend} margin={{ top: 15, right: 10, left: -10, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="year" stroke="#94a3b8" tick={{ fontSize: 11, fontFamily: 'monospace' }} />
                <YAxis stroke="#94a3b8" tick={{ fontSize: 11, fontFamily: 'monospace' }} />
                <Tooltip
                  content={({ active, payload }) => {
                    if (!active || !payload || !payload.length) return null;
                    const d = payload[0];
                    return (
                      <div className="p-2.5 rounded-lg bg-space-950 border border-emerald-500/40 text-xs font-mono shadow-2xl backdrop-blur-md">
                        <div className="text-slate-400 font-semibold">Year {d.payload.year}</div>
                        <div className="mt-1 text-emerald-300 font-bold">
                          {Number(d.value).toLocaleString()} Annual Launches
                        </div>
                      </div>
                    );
                  }}
                />
                <Bar dataKey="launches" fill="#10b981" name="Annual Launches" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Bar Chart: Country-wise Satellite Count */}
        <div className="glass-panel rounded-xl p-5 shadow-2xl flex flex-col justify-between">
          <div className="flex items-center justify-between pb-3 border-b border-cyan-500/20 mb-3">
            <h3 className="text-sm font-bold text-cyan-400 flex items-center gap-2">
              <Globe2 className="w-4 h-4 text-cyan-400" />
              Top Spacefaring Nations & Operating Agencies
            </h3>
            <span className="text-[11px] font-mono text-slate-400">National Distribution</span>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={countryDist}
                layout="vertical"
                margin={{ top: 10, right: 20, left: 25, bottom: 10 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis type="number" stroke="#94a3b8" tick={{ fontSize: 11, fontFamily: 'monospace' }} />
                <YAxis
                  dataKey="country"
                  type="category"
                  stroke="#94a3b8"
                  tick={{ fontSize: 10, fontFamily: 'sans-serif' }}
                  width={90}
                />
                <Tooltip
                  content={({ active, payload }) => {
                    if (!active || !payload || !payload.length) return null;
                    const d = payload[0];
                    return (
                      <div className="p-2.5 rounded-lg bg-space-950 border border-indigo-500/40 text-xs font-mono shadow-2xl backdrop-blur-md">
                        <div className="text-slate-300 font-bold">{d.payload.country}</div>
                        <div className="mt-1 text-indigo-300 font-bold">
                          {Number(d.value).toLocaleString()} Satellites
                        </div>
                      </div>
                    );
                  }}
                />
                <Bar dataKey="satellites" fill="#818cf8" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Feature 5: Ground Station Pass Predictor */}
      <PassPredictor />
    </div>
  );
};

export default Dashboard;
