import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: './',
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return;
          if (id.includes('/three/')) return 'globe-engine';
          if (id.includes('/react/') || id.includes('/react-dom/') || id.includes('/scheduler/')) return 'react-core';
          if (id.includes('/satellite.js/')) return 'orbit-model';
          if (id.includes('/d3-') || id.includes('/topojson-') || id.includes('/world-atlas/')) return 'map-data';
        },
      },
    },
  },
});
