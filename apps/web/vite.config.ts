import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  envDir: '../../',
  plugins: [react()],
  server: {
    port: 5173,
    host: true,
    allowedHosts: ['.trycloudflare.com'],
  },
  preview: {
    host: true,
    port: Number(process.env.PORT) || 4173,
    strictPort: true,
  },
});
