/**
 * OrbitGuard App Root Component
 * Sets up client-side routing, initial telemetry polling, and application layout.
 * Permanent Space Dark Theme applied.
 */

import React, { useEffect, lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Navbar from './components/Layout/Navbar';
import Home from './pages/Home';
import { useOrbitStore } from './store/useOrbitStore';
import ErrorBoundary from './components/common/ErrorBoundary';
import StaleDataBanner from './components/common/StaleDataBanner';
import PerformanceHUD from './components/common/PerformanceHUD';
import HelpModal from './components/common/HelpModal';

// Lazy-load heavier analytics pages to keep initial bundle small
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Conjunctions = lazy(() => import('./pages/Conjunctions'));
const RFSuite = lazy(() => import('./features/rf/RFSuite'));

const PageLoader = () => (
  <div className="flex items-center justify-center h-full min-h-[60vh]">
    <div className="flex flex-col items-center gap-3 text-cyan-400 font-mono text-sm">
      <div className="w-8 h-8 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
      <span>Loading Telemetry View...</span>
    </div>
  </div>
);

export const App = () => {
  const fetchInitialData = useOrbitStore((state) => state.fetchInitialData);
  const detectUserLocation = useOrbitStore((state) => state.detectUserLocation);
  const isHelpOpen = useOrbitStore((state) => state.isHelpOpen);
  const setHelpOpen = useOrbitStore((state) => state.setHelpOpen);
  const toggleHelp = useOrbitStore((state) => state.toggleHelp);
  const toggleHud = useOrbitStore((state) => state.toggleHud);
  const selectSatellite = useOrbitStore((state) => state.selectSatellite);
  const setSimulationSpeed = useOrbitStore((state) => state.setSimulationSpeed);

  // Initialize data on application startup and enforce dark theme
  useEffect(() => {
    document.documentElement.classList.add('dark');
    document.documentElement.classList.remove('light');

    fetchInitialData();
    detectUserLocation();

    // Periodic telemetry polling every 20 seconds
    const interval = setInterval(() => {
      fetchInitialData();
    }, 20000);

    return () => clearInterval(interval);
  }, [fetchInitialData]);

  // Global Keyboard Shortcuts (Phase 6)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target?.tagName)) {
        return;
      }

      if (e.key === '?') {
        toggleHelp();
      } else if (e.key === '`' || e.key === '~') {
        toggleHud();
      } else if (e.key === 'Escape') {
        selectSatellite(null);
        setHelpOpen(false);
      } else if (e.key === '1') {
        setSimulationSpeed(1);
      } else if (e.key === '5') {
        setSimulationSpeed(5);
      } else if (e.key === '6') {
        setSimulationSpeed(60);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [toggleHelp, toggleHud, selectSatellite, setHelpOpen, setSimulationSpeed]);

  return (
    <Router>
      <div className="min-h-screen bg-space-950 text-slate-100 flex flex-col font-sans">
        <Navbar />
        <StaleDataBanner />
        <PerformanceHUD />
        <HelpModal isOpen={isHelpOpen} onClose={() => setHelpOpen(false)} />
        <main className="flex-1 relative">
          <ErrorBoundary>
            <Suspense fallback={<PageLoader />}>
              <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/conjunctions" element={<Conjunctions />} />
                <Route path="/rf" element={<div className="p-3 md:p-6"><RFSuite /></div>} />
              </Routes>
            </Suspense>
          </ErrorBoundary>
        </main>
      </div>
    </Router>
  );
};

export default App;
