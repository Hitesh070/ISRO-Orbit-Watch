/**
 * OrbitGuard IPC Channel Constants
 * =================================
 * Zero-dependency channel identifiers safe for isolated Electron sandboxed preload.
 */

export const IPC_CHANNELS = {
  // Serial (COM ports)
  SERIAL_LIST: 'serial:list',
  SERIAL_OPEN: 'serial:open',
  SERIAL_WRITE: 'serial:write',
  SERIAL_CLOSE: 'serial:close',
  SERIAL_STATUS: 'serial:status',
  SERIAL_ON_DATA: 'serial:on-data',
  SERIAL_ON_ERROR: 'serial:on-error',
  SERIAL_ON_DISCONNECT: 'serial:on-disconnect',

  // rotctld TCP Client (Hamlib)
  ROTCTLD_CONNECT: 'rotctld:connect',
  ROTCTLD_COMMAND: 'rotctld:command',
  ROTCTLD_DISCONNECT: 'rotctld:disconnect',
  ROTCTLD_ON_DATA: 'rotctld:on-data',
  ROTCTLD_ON_ERROR: 'rotctld:on-error',

  // Offline Data Layer
  DATA_GET_CATALOG: 'data:get-catalog',
  DATA_GET_CONJUNCTIONS: 'data:get-conjunctions',
  DATA_GET_METADATA: 'data:get-metadata',
  DATA_REFRESH: 'data:refresh',
  DATA_CLEAR_CACHE: 'data:clear-cache',
  DATA_ON_UPDATED: 'data:on-updated',

  // Native Dialogs & Notifications
  NOTIFY_PASS_REMINDER: 'notify:pass-reminder',
  DIALOG_SAVE_FILE: 'dialog:save-file',
  DIALOG_OPEN_DATA_FOLDER: 'dialog:open-data-folder',
  DIALOG_OPEN_LOGS_FOLDER: 'dialog:open-logs-folder',

  // App & System Info
  SYSTEM_GET_INFO: 'system:get-info',
  UPDATER_CHECK: 'updater:check',
  UPDATER_INSTALL: 'updater:install',
  UPDATER_ON_STATUS: 'updater:on-status',
} as const;

export type IpcChannel = typeof IPC_CHANNELS[keyof typeof IPC_CHANNELS];
