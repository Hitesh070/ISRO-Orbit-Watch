import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SerialManager } from '../main/serialManager';

describe('SerialManager Safety & Windows COM Supervision', () => {
  let serialManager: SerialManager;

  beforeEach(() => {
    serialManager = new SerialManager();
  });

  describe('Windows COM Port Normalization', () => {
    it('normalizes single-digit COM ports without prefix', () => {
      expect(serialManager.normalizePortPath('COM1')).toBe('COM1');
      expect(serialManager.normalizePortPath('com3')).toBe('COM3');
      expect(serialManager.normalizePortPath('COM9')).toBe('COM9');
    });

    it('prepends \\\\.\\ to double-digit COM ports for Windows Win32 API compatibility', () => {
      expect(serialManager.normalizePortPath('COM10')).toBe('\\\\.\\COM10');
      expect(serialManager.normalizePortPath('com12')).toBe('\\\\.\\COM12');
      expect(serialManager.normalizePortPath('COM255')).toBe('\\\\.\\COM255');
    });

    it('leaves existing \\\\.\\ paths unchanged without double-prefixing', () => {
      expect(serialManager.normalizePortPath('\\\\.\\COM15')).toBe('\\\\.\\COM15');
    });

    it('trims whitespace cleanly', () => {
      expect(serialManager.normalizePortPath('  COM4  ')).toBe('COM4');
      expect(serialManager.normalizePortPath('  com11  ')).toBe('\\\\.\\COM11');
    });
  });

  describe('Mechanical Angle Clamping & Sanitization (Yaesu GS-232 & Easycomm)', () => {
    it('preserves valid Yaesu GS-232 positions with zero-padding', () => {
      expect(serialManager.sanitizeRotatorCommand('W180 045\r')).toBe('W180 045\r');
      expect(serialManager.sanitizeRotatorCommand('W5 9\r')).toBe('W005 009\r');
    });

    it('clamps excessive Yaesu GS-232 Azimuth to 450° to prevent cable wrap', () => {
      expect(serialManager.sanitizeRotatorCommand('W480 045\r')).toBe('W450 045\r');
      expect(serialManager.sanitizeRotatorCommand('W999 000\r')).toBe('W450 000\r');
    });

    it('clamps excessive Yaesu GS-232 Elevation to 180° to prevent physical mast crash', () => {
      expect(serialManager.sanitizeRotatorCommand('W180 220\r')).toBe('W180 180\r');
    });

    it('clamps Easycomm Azimuth and Elevation within safe limits', () => {
      expect(serialManager.sanitizeRotatorCommand('AZ125.4 EL45.2\n')).toBe('AZ125.4 EL45.2\n');
      expect(serialManager.sanitizeRotatorCommand('AZ500.0 EL210.0\n')).toBe('AZ450.0 EL180.0\n');
    });

    it('passes through control and query commands unmodified', () => {
      expect(serialManager.sanitizeRotatorCommand('S\r')).toBe('S\r');
      expect(serialManager.sanitizeRotatorCommand('C2\r')).toBe('C2\r');
      expect(serialManager.sanitizeRotatorCommand('VE\n')).toBe('VE\n');
    });
  });

  describe('Rate Limiter', () => {
    it('rejects commands when port is closed', async () => {
      const res = await serialManager.write('W180 045\r');
      expect(res.success).toBe(false);
      expect(res.error).toBe('COM port is not open');
    });
  });
});
