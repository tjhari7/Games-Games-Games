import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import svgr from 'vite-plugin-svgr';

export default defineConfig({
  plugins: [
    react(),
    // Lets `import X from './x.svg?react'` return a React component. `icon: true`
    // makes each SVG render at 1em, so the existing `font-size` rules in
    // index.css stay the size knob; `fill: currentColor` makes it take its
    // colour from CSS `color`, exactly like the old icon font did.
    svgr({
      include: '**/*.svg?react',
      svgrOptions: { icon: true, svgProps: { fill: 'currentColor' } },
    }),
  ],
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
