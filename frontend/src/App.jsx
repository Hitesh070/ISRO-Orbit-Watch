/**
 * OrbitGuard App Root Component
 * Sets up client-side routing, initial telemetry polling, and application layout.
 * Permanent Space Dark Theme applied.
 */

import React, { useEffect, lazy, Suspense } from 'react';
import { BrowserRouter, HashRouter, Routes, Route } from 'react-router-dom';
import Navbar from './components/Layout/Navbar';
import Home from './pages/Home';
import { useOrbitStore } from './store/useOrbitStore';
import ErrorBoundary from './components/common/ErrorBoundary';
import StaleDataBanner from './components/common/StaleDataBanner';
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

export const App = () => {
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
  }, [fetchInitialData]);

  // Master simulation clock ticker: advances simulatedTimeMs continuously based on simulationSpeed
  useEffect(() => {
    let lastWall = performance.now();
    const timer = setInterval(() => {
      const nowWall = performance.now();
      const dt = (nowWall - lastWall) / 1000;
      lastWall = nowWall;

      const state = useOrbitStore.getState();
      const speed = state.simulationSpeed || 1;
      const currentSim = state.simulatedTimeMs || Date.now();
      state.setSimulatedTimeMs(currentSim + dt * 1000 * speed);
    }, 250);

    return () => clearInterval(timer);
  }, []);

  // Read URL query parameters on initial load (?norad=... & ?speed=...)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const noradParam = params.get('norad');
    const speedParam = params.get('speed');

    if (speedParam) {
      const parsedSpeed = parseInt(speedParam, 10);
      if ([1, 5, 15, 60].includes(parsedSpeed)) {
        setSimulationSpeed(parsedSpeed);
      }
    }

    if (noradParam) {
      const pollAndSelect = (attempts = 0) => {
        const state = useOrbitStore.getState();
        if (state.catalog.length > 0 || state.satellites.length > 0) {
          state.selectSatellite(noradParam);
        } else if (attempts < 20) {
          setTimeout(() => pollAndSelect(attempts + 1), 250);
        }
      };
      pollAndSelect();
    }
  }, [setSimulationSpeed]);

  // Synchronize state changes back to URL search params (Deep-linking)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);

    if (selectedSatellite?.norad_id) {
      params.set('norad', String(selectedSatellite.norad_id));
    } else {
      params.delete('norad');
    }

    if (simulationSpeed > 1) {
      params.set('speed', String(simulationSpeed));
    } else {
      params.delete('speed');
    }

    const queryStr = params.toString() ? `?${params.toString()}` : '';
    const newUrl = `${window.location.pathname}${queryStr}${window.location.hash}`;
    window.history.replaceState(null, '', newUrl);
  }, [selectedSatellite?.norad_id, simulationSpeed]);

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
  ]);

  return (
    <Router>
      <div className="min-h-screen bg-space-950 text-slate-100 flex flex-col font-sans">
        <Navbar />
        <StaleDataBanner />
        <PerformanceHUD />
        <HelpModal isOpen={isHelpOpen} onClose={() => setHelpOpen(false)} />
        <SettingsDrawer isOpen={isSettingsOpen} onClose={() => setSettingsOpen(false)} />
        <InterviewTrainer isOpen={isTrainerOpen} onClose={() => setTrainerOpen(false)} />
        <OnboardingModal isOpen={isOnboardingOpen} onClose={() => setOnboardingOpen(false)} />
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
