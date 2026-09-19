import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.jsx';
import './index.css';
import './lib/orientationCover.js';

if ('scrollRestoration' in window.history) {
  window.history.scrollRestoration = 'manual';
}

// Ask for a real portrait lock where the browser allows one (Android Chrome in
// fullscreen or as an installed app). iOS Safari and Chrome refuse, or don't have
// the API at all — the "Turn your phone upright" cover in index.css is what
// holds the line there. Failing is expected, so the rejection is swallowed.
try {
  window.screen.orientation?.lock?.('portrait')?.catch(() => {});
} catch {
  // Some browsers throw synchronously instead of rejecting.
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);
