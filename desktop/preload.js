'use strict';

/**
 * Preload bridge — the ONLY surface the renderer can touch.
 *
 * Deliberately minimal and namespaced:
 *   window.schoolApp.auth     — login/logout/session/license lifecycle
 *   window.schoolApp.database — local SQLite reads/writes
 *   window.schoolApp.backup   — backup & restore
 *   window.schoolApp.files    — safe upload storage
 *   window.schoolApp.system   — version/diagnostics/links/logging
 *   window.schoolApp.updater  — auto-update events & actions
 *
 * No require, no process, no fs, no Node APIs leak to the renderer.
 * Every handler validates arguments in the main process.
 */

const { contextBridge, ipcRenderer } = require('electron');

const invoke = (channel, payload) => ipcRenderer.invoke(channel, payload);

const api = {
  auth: {
    login: (credentials) => invoke('auth:login', credentials),
    loginTeacherLocal: (code) => invoke('auth:login-teacher-local', code),
    logout: () => invoke('auth:logout'),
    sessionStatus: () => invoke('auth:session-status'),
    licenseStatus: () => invoke('auth:license-status'),
    validateNow: () => invoke('auth:validate-now'),
    getSupport: () => invoke('auth:get-support'),
    onLicenseChanged: (callback) => {
      const listener = (_event, payload) => callback(payload);
      ipcRenderer.on('auth:license-changed', listener);
      return () => ipcRenderer.removeListener('auth:license-changed', listener);
    },
    onSessionRestored: (callback) => {
      const listener = (_event, payload) => callback(payload);
      ipcRenderer.on('session:restored', listener);
      return () => ipcRenderer.removeListener('session:restored', listener);
    },
  },
  database: {
    load: () => invoke('db:load'),
    importLegacy: (data) => invoke('db:import-legacy', data),
    upsert: (collection, doc) => invoke('db:upsert', { collection, doc }),
    upsertMany: (collection, docs) => invoke('db:upsert-many', { collection, docs }),
    remove: (collection, id) => invoke('db:remove', { collection, id }),
    removeWhere: (collection, where) => invoke('db:remove-where', { collection, where }),
    replaceWhere: (collection, where, docs) => invoke('db:replace-where', { collection, where, docs }),
    deleteStudent: (id) => invoke('db:delete-student', id),
    deleteTeacher: (id) => invoke('db:delete-teacher', id),
    setSchoolInfo: (info) => invoke('db:set-school-info', info),
    replaceAll: (database) => invoke('db:replace-all', database),
  },
  backup: {
    create: () => invoke('backup:create'),
    list: () => invoke('backup:list'),
    restore: (fileName) => invoke('backup:restore', fileName),
    getExternalDir: () => invoke('backup:get-external-dir'),
    setExternalDir: (dir) => invoke('backup:set-external-dir', dir),
    chooseExternalDir: () => invoke('backup:choose-external-dir'),
    openFolder: () => invoke('backup:open-folder'),
  },
  files: {
    saveUpload: (payload) => invoke('files:save-upload', payload),
    list: (category) => invoke('files:list', category),
    open: (category, fileName) => invoke('files:open', { category, fileName }),
  },
  system: {
    info: () => invoke('system:info'),
    diagnostics: () => invoke('system:diagnostics'),
    openExternal: (url) => invoke('system:open-external', url),
    log: (level, message) => invoke('system:log', { level, message }),
    onStartupError: (callback) => {
      const listener = (_event, payload) => callback(payload);
      ipcRenderer.on('startup:error', listener);
      return () => ipcRenderer.removeListener('startup:error', listener);
    },
  },
  updater: {
    check: () => invoke('updater:check'),
    download: () => invoke('updater:download'),
    install: () => invoke('updater:install'),
    onStatus: (callback) => {
      const listener = (_event, payload) => callback(payload);
      ipcRenderer.on('updater:status', listener);
      return () => ipcRenderer.removeListener('updater:status', listener);
    },
  },
};

contextBridge.exposeInMainWorld('schoolApp', api);
