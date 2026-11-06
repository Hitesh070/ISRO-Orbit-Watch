/**
 * ThemeToggle Component
 * Toggles between Space Dark Mode (deep navy/black) and Light Mode.
 */

import React from 'react';
import { Sun, Moon } from 'lucide-react';
import { useOrbitStore } from '../../store/useOrbitStore';

export const ThemeToggle = () => {
  const theme = useOrbitStore((state) => state.theme);
  const toggleTheme = useOrbitStore((state) => state.toggleTheme);

  return (
    <button
      onClick={toggleTheme}
      title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
      className="p-2 rounded-lg bg-space-900 border border-slate-700 hover:border-cyan-400 text-cyan-300 hover:text-cyan-200 transition shadow-sm"
    >
      {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-300" /> : <Moon className="w-4 h-4 text-indigo-600" />}
    </button>
  );
};

export default ThemeToggle;
