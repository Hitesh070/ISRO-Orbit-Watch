/**
 * OrbitGuard Antenna Rotator Protocol Encoders & Decoders
 * ========================================================
 * Implements standard ground station antenna rotator communication protocols:
 * 1. Yaesu GS-232A / GS-232B (industry standard for satellite amateur & research stations)
 * 2. Easycomm I / Easycomm II
 * 3. Hamlib rotctld (TCP/serial position protocol)
 *
 * Specifications & Framing:
 * -------------------------
 * - Yaesu GS-232:
 *     Set Position: "W<AAA> <EEE>\r" (AAA: 000-450, EEE: 000-180)
 *     Stop:         "S\r"
 *     Query:        "C2\r"
 *     Replies:      "+0AAA+0EEE\r" or "AZ=AAA EL=EEE\r"
 * - Easycomm I/II:
 *     Set Position: "AZ<deg> EL<deg>\n" (e.g. "AZ124.5 EL45.2\n")
 *     Stop:         "VE\n"
 * - Hamlib rotctld:
 *     Set Position: "P <az> <el>\n"
 *     Query:        "p\n"
 *     Stop:         "S\n"
 */

export interface RotatorPosition {
  azDeg: number;
  elDeg: number;
}

/**
 * Normalizes an angle to 0 <= angle < 360
 */
export function normalizeAzimuth(azDeg: number, maxAz = 360): number {
  let a = azDeg % maxAz;
  if (a < 0) a += maxAz;
  return a;
}

/**
 * Clamps elevation to valid physical mechanical limits (default: 0° to 90° or 180° for flip-mode)
 */
export function clampElevation(elDeg: number, minEl = 0, maxEl = 90): number {
  return Math.max(minEl, Math.min(maxEl, elDeg));
}

// ==========================================
// 1. YAESU GS-232 PROTOCOL
// ==========================================

/**
 * Encodes a target position command in Yaesu GS-232 format.
 * Format: "W<AAA> <EEE>\r" (3-digit zero-padded integers)
 */
export function encodeGS232Position(azDeg: number, elDeg: number, is450Mode = false): string {
  const maxAz = is450Mode ? 450 : 360;
  const clampedAz = Math.max(0, Math.min(maxAz, Math.round(azDeg)));
  const clampedEl = Math.max(0, Math.min(180, Math.round(elDeg)));

  const azStr = String(clampedAz).padStart(3, '0');
  const elStr = String(clampedEl).padStart(3, '0');
  return `W${azStr} ${elStr}\r`;
}

/**
 * Encodes GS-232 Stop command: "S\r"
 */
export function encodeGS232Stop(): string {
  return 'S\r';
}

/**
 * Encodes GS-232 Position Query command: "C2\r"
 */
export function encodeGS232Query(): string {
  return 'C2\r';
}

/**
 * Parses Yaesu GS-232 query replies.
 * Supports:
 * - Standard style: "+0AAA+0EEE"
 * - Human-readable ASCII: "AZ=AAA EL=EEE"
 */
export function parseGS232Reply(reply: string): RotatorPosition | null {
  const clean = reply.trim();

  // Pattern 1: +0180+0045 (standard Yaesu binary-style string)
  const matchPlus = clean.match(/^\+0?(\d{3})\+0?(\d{3})/);
  if (matchPlus) {
    return {
      azDeg: parseInt(matchPlus[1], 10),
      elDeg: parseInt(matchPlus[2], 10),
    };
  };

  // Pattern 2: AZ=180 EL=45
  const matchAscii = clean.match(/AZ\s*=\s*(\d+)\s+EL\s*=\s*(\d+)/i);
  if (matchAscii) {
    return {
      azDeg: parseInt(matchAscii[1], 10),
      elDeg: parseInt(matchAscii[2], 10),
    };
  }

  return null;
}

// ==========================================
// 2. EASYCOMM PROTOCOL
// ==========================================

/**
 * Encodes Easycomm I position command: "AZ<deg> EL<deg>\n"
 */
export function encodeEasycommPosition(azDeg: number, elDeg: number): string {
  const az = (Math.round(azDeg * 10) / 10).toFixed(1);
  const el = (Math.round(Math.max(0, elDeg) * 10) / 10).toFixed(1);
  return `AZ${az} EL${el}\n`;
}

/**
 * Parses Easycomm status string: "AZ123.4 EL45.6"
 */
export function parseEasycommReply(reply: string): RotatorPosition | null {
  const match = reply.trim().match(/AZ\s*([\d.]+)\s+EL\s*([\d.]+)/i);
  if (match) {
    return {
      azDeg: parseFloat(match[1]),
      elDeg: parseFloat(match[2]),
    };
  }
  return null;
}

// ==========================================
// 3. HAMLIB ROTCTLD PROTOCOL
// ==========================================

/**
 * Encodes Hamlib rotctld position command: "P <az> <el>\n"
 */
export function encodeRotctldPosition(azDeg: number, elDeg: number): string {
  const az = (Math.round(azDeg * 10) / 10).toFixed(1);
  const el = (Math.round(Math.max(0, elDeg) * 10) / 10).toFixed(1);
  return `P ${az} ${el}\n`;
}

/**
 * Encodes Hamlib rotctld position query: "p\n"
 */
export function encodeRotctldQuery(): string {
  return 'p\n';
}

/**
 * Encodes Hamlib rotctld stop: "S\n"
 */
export function encodeRotctldStop(): string {
  return 'S\n';
}

/**
 * Parses Hamlib rotctld query response:
 * Returns either two lines:
 * "<az>\n<el>\n" or single line "<az> <el>"
 */
export function parseRotctldReply(reply: string): RotatorPosition | null {
  const tokens = reply.trim().split(/\s+/);
  if (tokens.length >= 2) {
    const az = parseFloat(tokens[0]);
    const el = parseFloat(tokens[1]);
    if (!isNaN(az) && !isNaN(el)) {
      return { azDeg: az, elDeg: el };
    }
  }
  return null;
}
