import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';

/**
 * Admin Control Panel — separate React SPA build.
 *
 * Output is served by the control-plane server itself at /admin
 * (same-origin → no CORS surface for the admin API).
 */
export default defineConfig(() => {
  return {
    root: 'admin',
    base: '/admin/',
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@admin': path.resolve(__dirname, 'admin/src'),
      },
    },
    build: {
      outDir: path.resolve(__dirname, 'server/public/admin'),
      emptyOutDir: true,
      target: 'es2020',
    },
    server: {
      // Allow the sandboxed live-preview host (*.e2b.app) in dev.
      allowedHosts: ['.e2b.app'],
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
      proxy: {
        // Dev-only: forward the admin API to the local control-plane server.
        '/admin/api': {
          target: 'http://localhost:8080',
          changeOrigin: false,
        },
      },
    },
  };
});
