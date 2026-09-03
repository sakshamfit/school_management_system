/**
 * Control-plane bridge for the React renderer (desktop only).
 *
 * When the app runs inside Electron, `window.controlPlane` is provided by
 * the preload script. In a plain browser (development, PWA) it is absent
 * and `isDesktop()` returns false — callers must no-op gracefully.
 */

export type LicensePhase =
  | 'CHECKING'
  | 'LOGGED_OUT'
  | 'AUTHORIZED'
  | 'OFFLINE_GRACE'
  | 'GRACE_EXPIRED'
  | 'BLOCKED'
  | 'SERVER_UNAVAILABLE';

export interface ControlPlaneState {
  phase: LicensePhase;
  blockReason: string | null;
  user: { id: string; name: string; email: string; role: string; must_change_password?: boolean } | null;
  school: { id?: string; name: string; school_code?: string; status?: string } | null;
  license: {
    id?: string;
    license_key?: string;
    status: string;
    expires_at?: string;
    max_devices?: number;
  } | null;
  device: { name?: string; device_uid?: string; status?: string } | null;
  deviceIdentity: { deviceUid: string; defaultName: string; platform: string };
  secureStoragePersistent: boolean;
  offline: {
    lastValidatedAt: string | null;
    graceHours: number;
    remainingHours: number;
    graceExpired: boolean;
  };
  serverUrlDisplay: string;
  appVersion: string;
}

export interface LoginResult {
  ok: boolean;
  code?: string;
  message?: string;
  state: ControlPlaneState;
}

export interface SupportInfo {
  appVersion: string;
  schoolId: string | null;
  schoolName: string | null;
  licenseStatus: string;
  licenseExpiresAt: string | null;
  deviceReference: string;
  deviceName: string;
  platform: string;
  diagnosticsId: string;
  serverHost: string;
  lastValidatedAt: string | null;
}

export interface UpdateCheckResult {
  ok: boolean;
  update_available?: boolean;
  mandatory_update?: boolean;
  release?: {
    version: string;
    release_date: string;
    download_url: string;
    notes: string | null;
    mandatory: boolean;
  } | null;
  message?: string;
}

interface ControlPlaneBridge {
  getState(): Promise<ControlPlaneState>;
  login(input: { email: string; password: string; schoolCode?: string }): Promise<LoginResult>;
  logout(): Promise<void>;
  refreshLicense(): Promise<ControlPlaneState>;
  getSupportInfo(): Promise<SupportInfo>;
  checkForUpdates(): Promise<UpdateCheckResult>;
  onStateChange(cb: (state: ControlPlaneState) => void): () => void;
}

declare global {
  interface Window {
    controlPlane?: ControlPlaneBridge;
    isElectronDesktop?: boolean;
  }
}

export function isDesktop(): boolean {
  return typeof window !== 'undefined' && !!window.controlPlane;
}

export function getControlPlane(): ControlPlaneBridge | null {
  return typeof window !== 'undefined' ? window.controlPlane ?? null : null;
}
