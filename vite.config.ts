import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base './' lets the built site work from any GitHub Pages sub-path.
export default defineConfig({
  base: './',
  plugins: [react()],
});
