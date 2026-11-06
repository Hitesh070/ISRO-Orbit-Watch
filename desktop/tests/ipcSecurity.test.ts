import { describe, it, expect } from 'vitest';
import {
  SerialOpenOptionsSchema,
  SerialWriteSchema,
  RotctldConnectOptionsSchema,
  RotctldCommandSchema,
  PassReminderSchema,
  SaveFileDialogSchema,
} from '../../frontend/src/shared/ipc';

describe('Desktop IPC Contracts & Zod Validation Schemas', () => {
  describe('SerialOpenOptionsSchema', () => {
    it('accepts valid standard COM port and applies default settings', () => {
      const parsed = SerialOpenOptionsSchema.parse({
        path: 'COM3',
      });
      expect(parsed.path).toBe('COM3');
      expect(parsed.baudRate).toBe(9600);
      expect(parsed.dataBits).toBe(8);
      expect(parsed.stopBits).toBe(1);
      expect(parsed.parity).toBe('none');
    });

    it('accepts Windows \\\\.\\COM15 extended port syntax with custom baud', () => {
      const parsed = SerialOpenOptionsSchema.parse({
        path: '\\\\.\\COM15',
        baudRate: 115200,
        stopBits: 2,
        parity: 'even',
      });
      expect(parsed.path).toBe('\\\\.\\COM15');
      expect(parsed.baudRate).toBe(115200);
      expect(parsed.stopBits).toBe(2);
      expect(parsed.parity).toBe('even');
    });

    it('rejects out-of-range baud rates', () => {
      expect(() =>
        SerialOpenOptionsSchema.parse({
          path: 'COM1',
          baudRate: 300, // below min 1200
        })
      ).toThrow();

      expect(() =>
        SerialOpenOptionsSchema.parse({
          path: 'COM1',
          baudRate: 2000000, // above max 115200
        })
      ).toThrow();
    });

    it('rejects invalid parity options', () => {
      expect(() =>
        SerialOpenOptionsSchema.parse({
          path: 'COM1',
          parity: 'invalid' as any,
        })
      ).toThrow();
    });

    it('rejects empty port path', () => {
      expect(() =>
        SerialOpenOptionsSchema.parse({
          path: '',
        })
      ).toThrow();
    });
  });

  describe('SerialWriteSchema', () => {
    it('accepts valid rotator commands', () => {
      const parsed = SerialWriteSchema.parse({
        data: 'W180 045\r',
      });
      expect(parsed.data).toBe('W180 045\r');
    });

    it('rejects payloads exceeding max length', () => {
      const longPayload = 'A'.repeat(1025);
      expect(() =>
        SerialWriteSchema.parse({
          data: longPayload,
        })
      ).toThrow();
    });
  });

  describe('RotctldConnectOptionsSchema', () => {
    it('defaults to 127.0.0.1:4533 if empty object is provided', () => {
      const parsed = RotctldConnectOptionsSchema.parse({});
      expect(parsed.host).toBe('127.0.0.1');
      expect(parsed.port).toBe(4533);
    });

    it('accepts valid custom IP and port', () => {
      const parsed = RotctldConnectOptionsSchema.parse({
        host: '192.168.1.50',
        port: 4534,
      });
      expect(parsed.host).toBe('192.168.1.50');
      expect(parsed.port).toBe(4534);
    });

    it('rejects invalid ports', () => {
      expect(() =>
        RotctldConnectOptionsSchema.parse({
          port: 0,
        })
      ).toThrow();

      expect(() =>
        RotctldConnectOptionsSchema.parse({
          port: 70000,
        })
      ).toThrow();
    });
  });

  describe('PassReminderSchema', () => {
    it('validates correct pass reminder payload and assigns default leadMinutes', () => {
      const parsed = PassReminderSchema.parse({
        noradId: 25544,
        satelliteName: 'ISS (ZARYA)',
        aosTimeUtc: '2026-11-07T12:00:00Z',
        maxElevationDeg: 78.4,
      });
      expect(parsed.noradId).toBe(25544);
      expect(parsed.leadMinutes).toBe(10);
      expect(parsed.maxElevationDeg).toBeCloseTo(78.4);
    });

    it('rejects negative or invalid noradId', () => {
      expect(() =>
        PassReminderSchema.parse({
          noradId: -5,
          satelliteName: 'Invalid',
          aosTimeUtc: '2026-11-07T12:00:00Z',
          maxElevationDeg: 45,
        })
      ).toThrow();
    });

    it('rejects elevation > 90 degrees', () => {
      expect(() =>
        PassReminderSchema.parse({
          noradId: 25544,
          satelliteName: 'ISS',
          aosTimeUtc: '2026-11-07T12:00:00Z',
          maxElevationDeg: 95,
        })
      ).toThrow();
    });
  });

  describe('SaveFileDialogSchema', () => {
    it('validates save dialog options with defaults', () => {
      const parsed = SaveFileDialogSchema.parse({
        content: '{"data": "test"}',
      });
      expect(parsed.content).toBe('{"data": "test"}');
      expect(parsed.encoding).toBe('utf8');
    });

    it('accepts base64 encoding', () => {
      const parsed = SaveFileDialogSchema.parse({
        content: 'SGVsbG8gV29ybGQ=',
        encoding: 'base64',
      });
      expect(parsed.encoding).toBe('base64');
    });

    it('rejects invalid encoding types', () => {
      expect(() =>
        SaveFileDialogSchema.parse({
          content: 'data',
          encoding: 'hex' as any,
        })
      ).toThrow();
    });
  });
});
