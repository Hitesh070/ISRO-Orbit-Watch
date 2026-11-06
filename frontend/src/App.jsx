/**
 * OrbitGuard App Root Component
 * Sets up client-side routing, initial telemetry polling, and application layout.
 * Permanent Space Dark Theme applied.
 */

import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Navbar from './components/Layout/Navbar';
import Home from './pages/Home';
import Dashboard from './pages/Dashboard';
import Conjunctions from './pages/Conjunctions';
import { useOrbitStore } from './store/useOrbitStore';

export const App = () => {
  const fetchInitialData = useOrbitStore((state) => state.fetchInitialData);

  // Initialize data on application startup and enforce dark theme
  useEffect(() => {
    document.documentElement.classList.add('dark');
    document.documentElement.classList.remove('light');

    fetchInitialData();

    // Periodic telemetry polling every 20 seconds
    const interval = setInterval(() => {
      fetchInitialData();
    }, 20000);

    return () => clearInterval(interval);
  }, [fetchInitialData]);

  return (
    <Router>
      <div className="min-h-screen bg-space-950 text-slate-100 flex flex-col font-sans select-none">
        <Navbar />
        <main className="flex-1 relative">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/conjunctions" element={<Conjunctions />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
};

export default App;
