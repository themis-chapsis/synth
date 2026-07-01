import { defineConfig } from 'vite';

// Static-host friendly build: relative base so dist/ can be served from any
// path on any static file host. No plugins, no framework.
export default defineConfig({
  base: './',
  build: {
    target: 'es2022',
    sourcemap: false
  }
});
