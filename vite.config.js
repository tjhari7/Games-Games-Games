import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: process.env.PORT ? Number(process.env.PORT) : 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
    // Vite rejects requests whose Host header it does not recognise, which makes
    // the dev server return 403 behind a tunnel (localtunnel/ngrok) used to share
    // the app on a phone. Allow the tunnel hosts through. Dev-only config.
    allowedHosts: ['.loca.lt', '.ngrok-free.app', '.ngrok.io', '.trycloudflare.com'],
  },
});
