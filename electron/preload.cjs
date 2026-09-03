/**
 * Preload — the renderer's ONLY bridge to the control plane.
 *
 * Exposes a minimal, explicit API surface on window.controlPlane.
 * ipcRenderer itself is never exposed; the renderer cannot send
 * arbitrary IPC messages or reach Node APIs.
 */

const { contextBridge, ipcRenderer } = require('electron');

const VALID_EVENTS = new Set(['control-plane:state']);

contextBridge.exposeInMainWorld('controlPlane', {
  getState: () => ipcRenderer.invoke('control-plane:get-state'),
  login: credentials => ipcRenderer.invoke('control-plane:login', credentials),
  logout: () => ipcRenderer.invoke('control-plane:logout'),
  refreshLicense: () => ipcRenderer.invoke('control-plane:validate'),
  getSupportInfo: () => ipcRenderer.invoke('control-plane:support-info'),
  checkForUpdates: () => ipcRenderer.invoke('control-plane:check-updates'),
  onStateChange: callback => {
    const listener = (_event, state) => callback(state);
    ipcRenderer.on('control-plane:state', listener);
    return () => ipcRenderer.removeListener('control-plane:state', listener);
  },
});

contextBridge.exposeInMainWorld('isElectronDesktop', true);
