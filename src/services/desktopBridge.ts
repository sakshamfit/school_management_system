/**
 * Typed access to the Electron preload bridge (window.schoolApp).
 *
 * In the desktop edition this is the ONLY way the renderer reaches the
 * operating system, the local SQLite database or the license service.
 * In the web edition `isDesktopApp()` is false and Firestore is used instead.
 */

export interface DesktopSessionInfo {
  authenticated: boolean;
  mode: 'online' | 'offline' | null;
  school: {
    id: string;
    schoolCode: string;
    name: string;
    address?: string;
    phone?: string;
    email?: string;
    status?: string;
  } | null;
  user: {
    id: string;
    name: string;
    email: string;
    role: string;
    status?: string;
    teacherCode?: string;
    assignedClassId?: string;
    assignedClassName?: string;
    subject?: string;
    phone?: string;
    photoUrl?: string;
  } | null;
  isTeacherSession: boolean;
  license: {
    licenseKey: string;
    status: string;
    effectiveStatus: 'ACTIVE' | 'EXPIRED' | 'SUSPENDED' | 'REVOKED';
    issuedAt: string;
    expiresAt: string;
    maxDevices: number;
    devicesUsed: number;
    offlineGraceDays: number;
    revalidateHours: number;
  } | null;
  policy: { offlineGraceDays: number; revalidateHours: number } | null;
  support: { url?: string; email?: string; phone?: string } | null;
  lastVerifiedAt: string | null;
  offline: {
    allowed: boolean;
    reason: string;
    daysSinceVerified?: number;
    graceDays?: number;
  };
}

export interface DesktopLoginResult {
  ok?: boolean;
  error?: boolean;
  code?: string;
  message?: string;
  session?: DesktopSessionInfo;
  newDeviceActivated?: boolean;
  raw?: { support?: { url?: string; email?: string; phone?: string } };
}

export interface DesktopBackupInfo {
  file: string;
  size: number;
  createdAt: string;
}

interface SchoolAppApi {
  auth: {
    login: (credentials: { identifier: string; password: string }) => Promise<DesktopLoginResult>;
    loginTeacherLocal: (code: string) => Promise<DesktopLoginResult>;
    logout: () => Promise<{ ok: boolean }>;
    sessionStatus: () => Promise<{ ok: boolean; session: DesktopSessionInfo }>;
    licenseStatus: () => Promise<any>;
    validateNow: () => Promise<any>;
    getSupport: () => Promise<{ ok: boolean; support: any }>;
    onLicenseChanged: (callback: (payload: any) => void) => () => void;
    onSessionRestored: (callback: (payload: any) => void) => () => void;
  };
  database: {
    load: (payload?: { legacyDatabase?: any }) => Promise<any>;
    importLegacy: (payload: { legacyDatabase?: any }) => Promise<{ ok: boolean; imported: boolean }>;
    upsert: (collection: string, doc: any) => Promise<any>;
    upsertMany: (collection: string, docs: any[]) => Promise<any>;
    remove: (collection: string, id: string) => Promise<any>;
    removeWhere: (collection: string, where: Record<string, string>) => Promise<any>;
    replaceWhere: (collection: string, where: Record<string, string>, docs: any[]) => Promise<any>;
    deleteStudent: (id: string) => Promise<any>;
    deleteTeacher: (id: string) => Promise<any>;
    setSchoolInfo: (info: any) => Promise<any>;
    replaceAll: (database: any) => Promise<any>;
  };
  backup: {
    create: () => Promise<{ file?: string; path?: string; mirrored?: boolean; error?: boolean; message?: string }>;
    list: () => Promise<{ ok: boolean; backups: DesktopBackupInfo[]; externalDir: string | null }>;
    restore: (fileName: string) => Promise<any>;
    getExternalDir: () => Promise<{ ok: boolean; dir: string | null }>;
    setExternalDir: (dir: string | null) => Promise<any>;
    chooseExternalDir: () => Promise<{ ok: boolean; dir?: string; canceled?: boolean; message?: string }>;
    openFolder: () => Promise<{ ok: boolean }>;
  };
  files: {
    saveUpload: (payload: { category: string; fileName: string; dataBase64: string }) => Promise<any>;
    list: (category: string) => Promise<any>;
    open: (category: string, fileName: string) => Promise<any>;
  };
  system: {
    info: () => Promise<any>;
    diagnostics: () => Promise<{ ok: boolean; report: any }>;
    openExternal: (url: string) => Promise<any>;
    log: (level: string, message: string) => Promise<any>;
    onStartupError: (callback: (payload: { code: string; message: string }) => void) => () => void;
  };
  updater: {
    check: () => Promise<any>;
    download: () => Promise<any>;
    install: () => Promise<any>;
    onStatus: (callback: (status: any) => void) => () => void;
  };
}

declare global {
  interface Window {
    schoolApp?: SchoolAppApi;
  }
}

export function isDesktopApp(): boolean {
  return typeof window !== 'undefined' && !!window.schoolApp;
}

export function getSchoolApp(): SchoolAppApi | null {
  return typeof window !== 'undefined' ? window.schoolApp || null : null;
}
