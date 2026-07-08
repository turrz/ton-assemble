import React from 'react';
import ReactDOM from 'react-dom/client';
import { TonConnectUIProvider } from '@tonconnect/ui-react';
import App from './App';
import './index.css';

const tg = window.Telegram?.WebApp;
if (tg) {
  tg.ready();
  tg.expand();
  if (typeof (tg as any).setHeaderColor === 'function') (tg as any).setHeaderColor('#0a0c0f');
  if (typeof (tg as any).setBackgroundColor === 'function') (tg as any).setBackgroundColor('#0a0c0f');
  if (tg.colorScheme === 'light') {
    document.documentElement.classList.add('force-dark');
  }
}

// Use current origin so manifest and icon load from same domain (fixes Wallet manifest error when domain changes)
const baseUrl = typeof window !== 'undefined' ? window.location.origin : (import.meta.env.VITE_API_URL || '');
const manifestUrl = `${baseUrl}/tonconnect-manifest.json`;

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <TonConnectUIProvider manifestUrl={manifestUrl}>
      <App />
    </TonConnectUIProvider>
  </React.StrictMode>
);
