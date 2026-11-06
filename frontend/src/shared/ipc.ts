/**
 * OrbitGuard IPC Contracts, Types and Zod Validation Schemas
 * ==========================================================
 * Shared contract between Electron Main Process, Preload Bridge, and Renderer.
 * All IPC channels are strictly allow-listed and runtime-validated.
 */

import { z } from 'zod';

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

// ==========================================
// Zod Runtime Validation Schemas
// ==========================================

export const SerialOpenOptionsSchema = z.object({
  path: z.string().min(1).max(256),
  baudRate: z.number().int().min(1200).max(115200).default(9600),
  dataBits: z.union([z.literal(5), z.literal(6), z.literal(7), z.literal(8)]).default(8),
  stopBits: z.union([z.literal(1), z.literal(2)]).default(1),
  parity: z.enum(['none', 'even', 'odd', 'mark', 'space']).default('none'),
});
export type SerialOpenOptions = z.input<typeof SerialOpenOptionsSchema>;
export type SerialOpenOptionsParsed = z.output<typeof SerialOpenOptionsSchema>;

export const SerialWriteSchema = z.object({
  data: z.string().max(1024),
});
export type SerialWritePayload = z.infer<typeof SerialWriteSchema>;

export const RotctldConnectOptionsSchema = z.object({
  host: z.string().min(1).default('127.0.0.1'),
  port: z.number().int().min(1).max(65535).default(4533),
});
export type RotctldConnectOptions = z.input<typeof RotctldConnectOptionsSchema>;

export const RotctldCommandSchema = z.object({
  command: z.string().min(1).max(256),
});
export type RotctldCommandPayload = z.infer<typeof RotctldCommandSchema>;

export const PassReminderSchema = z.object({
  noradId: z.number().int().positive(),
  satelliteName: z.string().min(1).max(128),
  aosTimeUtc: z.string(),
  maxElevationDeg: z.number().min(0).max(90),
  leadMinutes: z.number().int().min(1).max(60).default(10),
});
export type PassReminder = z.input<typeof PassReminderSchema>;

export const SaveFileDialogSchema = z.object({
  defaultPath: z.string().optional(),
  filters: z.array(z.object({ name: z.string(), extensions: z.array(z.string()) })).optional(),
  content: z.string(),
  encoding: z.enum(['utf8', 'base64']).default('utf8'),
});
export type SaveFileDialogOptions = z.input<typeof SaveFileDialogSchema>;

// ==========================================
// Data Structures & Payload Types
// ==========================================

export interface SerialPortInfo {
  path: string;
  friendlyName: string;
  manufacturer?: string;
  vendorId?: string;
  productId?: string;
}

export interface SerialStatus {
  isOpen: boolean;
  port: string | null;
  baudRate: number | null;
}

export interface DataCacheMetadata {
  fetchTime: string;
  source: string;
  satellitesCount: number;
  debrisCount: number;
  oldestEpoch?: string;
  newestEpoch?: string;
  checksum?: string;
  isOffline: boolean;
  lastSyncAttempt?: string;
}

export interface SystemInfo {
  appVersion: string;
  electronVersion: string;
  chromiumVersion: string;
  nodeVersion: string;
  platform: string;
  arch: string;
  isPackaged: boolean;
  userDataPath: string;
}

export interface UpdateStatus {
  status: 'checking' | 'available' | 'not-available' | 'downloading' | 'downloaded' | 'error';
  info?: {
    version: string;
    releaseDate?: string;
    releaseNotes?: string;
  };
  progressPercent?: number;
  error?: string;
}
