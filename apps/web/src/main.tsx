import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './app/globals.css';
import './styles/advisio-ui.css';
import './styles/appearance.css';
import './styles/phone.css';
import { OFFLINE_ENABLED } from './lib/offline/store';
import { setOfflineOnly } from './lib/offline/access';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

window.addEventListener('offline', () => {
  if (localStorage.getItem(OFFLINE_ENABLED) === '1') setOfflineOnly(true);
});

if (import.meta.env.PROD && 'serviceWorker' in navigator && localStorage.getItem(OFFLINE_ENABLED) === '1') {
  void navigator.serviceWorker.register('/advisio-sw.js', { scope: '/', updateViaCache: 'none' }).catch(() => {
    // The installed worker remains usable when an update cannot be downloaded.
  });
}
