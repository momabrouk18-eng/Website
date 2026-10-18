import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Static files (icon, 404 page) live in /static and are copied as-is.
// The finished site is written to /dist, which Firebase Hosting serves.
export default defineConfig({
  plugins: [react()],
  publicDir: 'static',
  build: { outDir: 'dist', emptyOutDir: true, chunkSizeWarningLimit: 900 }
});
