import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  envDir: '../../',
  plugins: [react()],
  optimizeDeps: {
    include: ['@tg-creator/engine-3d > playcanvas'],
  },
  server: {
    port: 5174,
    host: true,
    allowedHosts: ['.trycloudflare.com'],
  },
  preview: {
    host: true,
    port: Number(process.env.PORT) || 4174,
    strictPort: true,
    allowedHosts: ['.railway.app', '.trycloudflare.com'],
  },
});
