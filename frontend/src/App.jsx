/**
 * OrbitGuard App Root Component
 * Sets up client-side routing, initial telemetry polling, and application layout.
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
  const theme = useOrbitStore((state) => state.theme);

  // Initialize data on application startup
  useEffect(() => {
    fetchInitialData();

    // Periodic telemetry polling every 30 seconds
    const interval = setInterval(() => {
      fetchInitialData();
    }, 30000);

    return () => clearInterval(interval);
  }, [fetchInitialData]);

  // Apply theme class to document element
  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
      document.documentElement.classList.remove('light');
    } else {
      document.documentElement.classList.remove('dark');
      document.documentElement.classList.add('light');
    }
  }, [theme]);

  return (
    <Router>
      <div className="min-h-screen bg-space-950 text-slate-100 flex flex-col font-sans transition-colors duration-200">
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
