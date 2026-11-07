/**
 * OrbitGuard App Root Component
 * Sets up client-side routing, initial telemetry polling, and application layout.
 * Permanent Space Dark Theme applied.
 */

import React, { useEffect, lazy, Suspense } from 'react';
import { BrowserRouter, HashRouter, Routes, Route, useLocation } from 'react-router-dom';
import Navbar from './components/Layout/Navbar';
import Home from './pages/Home';
import { useOrbitStore } from './store/useOrbitStore';
import ErrorBoundary from './components/common/ErrorBoundary';
import PerformanceHUD from './components/common/PerformanceHUD';
import HelpModal from './components/common/HelpModal';
import SettingsDrawer from './components/common/SettingsDrawer';
import InterviewTrainer from './features/interview/InterviewTrainer';
import OnboardingModal from './components/common/OnboardingModal';
import { platform } from './platform';

// In desktop Electron (file:// protocol), HashRouter guarantees reliable navigation;
// on web (https:// Vercel), BrowserRouter provides standard HTML5 history paths.
const Router =
  typeof window !== 'undefined' && (window.location.protocol === 'file:' || platform.isDesktop)
    ? HashRouter
    : BrowserRouter;

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

const AppContent = () => {
  const location = useLocation();
  const isHomePage = location.pathname === '/' || location.pathname === '';

  const fetchInitialData = useOrbitStore((state) => state.fetchInitialData);
  const detectUserLocation = useOrbitStore((state) => state.detectUserLocation);
  const isHelpOpen = useOrbitStore((state) => state.isHelpOpen);
  const setHelpOpen = useOrbitStore((state) => state.setHelpOpen);
  const toggleHelp = useOrbitStore((state) => state.toggleHelp);
  const toggleHud = useOrbitStore((state) => state.toggleHud);
  const isSettingsOpen = useOrbitStore((state) => state.isSettingsOpen);
  const setSettingsOpen = useOrbitStore((state) => state.setSettingsOpen);
  const toggleSettings = useOrbitStore((state) => state.toggleSettings);
  const isTrainerOpen = useOrbitStore((state) => state.isTrainerOpen);
  const setTrainerOpen = useOrbitStore((state) => state.setTrainerOpen);
  const toggleTrainer = useOrbitStore((state) => state.toggleTrainer);
  const isOnboardingOpen = useOrbitStore((state) => state.isOnboardingOpen);
  const setOnboardingOpen = useOrbitStore((state) => state.setOnboardingOpen);

  const selectedSatellite = useOrbitStore((state) => state.selectedSatellite);
  const selectSatellite = useOrbitStore((state) => state.selectSatellite);
  const simulationSpeed = useOrbitStore((state) => state.simulationSpeed);
  const setSimulationSpeed = useOrbitStore((state) => state.setSimulationSpeed);
  const catalog = useOrbitStore((state) => state.catalog);

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
  }, [fetchInitialData, detectUserLocation]);

  // Enforce zero window scrollbars when on the Home 3D viewport
  useEffect(() => {
    if (isHomePage) {
      document.documentElement.classList.add('overflow-hidden');
      document.body.classList.add('overflow-hidden');
    } else {
      document.documentElement.classList.remove('overflow-hidden');
      document.body.classList.remove('overflow-hidden');
    }
    return () => {
      document.documentElement.classList.remove('overflow-hidden');
      document.body.classList.remove('overflow-hidden');
    };
  }, [isHomePage]);

  // Master simulation clock ticker: advances simulatedTimeMs continuously based on simulationSpeed
  useEffect(() => {
    if (simulationSpeed === 0) return;

    let lastTick = performance.now();
    const interval = setInterval(() => {
      const now = performance.now();
      const deltaWallMs = now - lastTick;
      lastTick = now;

      const deltaSimMs = deltaWallMs * simulationSpeed;
      useOrbitStore.setState((state) => ({
        simulatedTimeMs: state.simulatedTimeMs + deltaSimMs,
      }));
    }, 100);

    return () => clearInterval(interval);
  }, [simulationSpeed]);

  // Global Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName)) return;

      if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
        const sats = catalog.filter((s) => s.object_type !== 'Debris');
        if (!sats.length) return;
        const currIdx = sats.findIndex((s) => s.norad_id === selectedSatellite?.norad_id);
        const nextIdx =
          e.key === 'ArrowRight'
            ? (currIdx + 1) % sats.length
            : (currIdx - 1 + sats.length) % sats.length;
        selectSatellite(sats[nextIdx]);
        return;
      }

      if (e.key === ' ') {
        e.preventDefault();
        setSimulationSpeed(simulationSpeed === 0 ? 1 : 0);
        return;
      }

      if (e.key === '?') {
        toggleHelp();
      } else if (e.key === '`' || e.key === '~') {
        toggleHud();
      } else if (e.key === 'i' || e.key === 'I') {
        toggleTrainer();
      } else if (e.key === ',') {
        toggleSettings();
      } else if (e.key === 'Escape') {
        selectSatellite(null);
        setHelpOpen(false);
        setSettingsOpen(false);
        setTrainerOpen(false);
        setOnboardingOpen(false);
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
  }, [
    toggleHelp,
    toggleHud,
    toggleTrainer,
    toggleSettings,
    selectSatellite,
    setHelpOpen,
    setSettingsOpen,
    setTrainerOpen,
    setOnboardingOpen,
    setSimulationSpeed,
    catalog,
    selectedSatellite,
    simulationSpeed,
  ]);

  return (
    <div
      className={`bg-space-950 text-slate-100 flex flex-col font-sans ${
        isHomePage ? 'h-screen w-screen overflow-hidden' : 'min-h-screen overflow-y-auto'
      }`}
    >
      <Navbar />
      <PerformanceHUD />
      <HelpModal isOpen={isHelpOpen} onClose={() => setHelpOpen(false)} />
      <SettingsDrawer isOpen={isSettingsOpen} onClose={() => setSettingsOpen(false)} />
      <InterviewTrainer isOpen={isTrainerOpen} onClose={() => setTrainerOpen(false)} />
      <OnboardingModal isOpen={isOnboardingOpen} onClose={() => setOnboardingOpen(false)} />
      <main className={`flex-1 relative ${isHomePage ? 'overflow-hidden h-full min-h-0' : ''}`}>
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
  );
};

export const App = () => {
  return (
    <Router>
      <AppContent />
    </Router>
  );
};

export default App;
