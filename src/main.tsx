import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import {LicenseGate} from './components/licensing/LicenseGate.tsx';
import {isDesktop} from './services/controlPlane.ts';
import './index.css';

// The commercial license gate applies only inside the Electron desktop
// app. The plain-browser build (development / PWA) renders unchanged.
const root = <App />;

createRoot(document.getElementById('root')!).render(
  <StrictMode>{isDesktop() ? <LicenseGate>{root}</LicenseGate> : root}</StrictMode>,
);
