"""
OrbitGuard Local Rotator Bridge Daemon
======================================
Connects the browser frontend (ws://127.0.0.1:8765) to the rotator (currently the built-in
MockGS232Rotator emulator). Binds to loopback only and REJECTS browser connections whose
Origin header is not allow-listed, so a random website cannot move your antenna.

Env: ORBITGUARD_ALLOWED_ORIGINS="https://a.example,http://localhost:5173"  (comma separated)
"""

import asyncio
import json
import os
import sys

from mock_gs232 import MockGS232Rotator

try:
    import websockets
except ImportError:
    print("[OrbitGuard Bridge] Error: 'websockets' not installed. Run: pip install websockets")
    sys.exit(1)

DEFAULT_ORIGINS = [
    "https://orbit-guard-tan.vercel.app",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:4173",
    "http://127.0.0.1:4173",
]


def allowed_origins():
    env = os.getenv("ORBITGUARD_ALLOWED_ORIGINS")
    origins = [o.strip() for o in env.split(",") if o.strip()] if env else list(DEFAULT_ORIGINS)
    # Browsers always send Origin; `None` admits non-browser tools (curl, scripts) only.
    return origins + [None]


class RotatorBridge:
    def __init__(self, host="127.0.0.1", port=8765):
        self.host = host
        self.port = port
        self.mock_rotator = MockGS232Rotator()
        self.mock_rotator.start()

    def _status(self):
        r = self.mock_rotator
        moving = abs(r.commanded_az - r.actual_az) > 0.2 or abs(r.commanded_el - r.actual_el) > 0.2
        return json.dumps({
            "type": "STATUS",
            "actualAz": round(r.actual_az, 1),
            "actualEl": round(r.actual_el, 1),
            "commandedAz": round(r.commanded_az, 1),
            "commandedEl": round(r.commanded_el, 1),
            "isMoving": moving,
        })

    async def handle_client(self, websocket):
        print(f"[OrbitGuard Bridge] Client connected from {websocket.remote_address}")

        async def status_emitter():
            try:
                while True:
                    await asyncio.sleep(0.1)
                    await websocket.send(self._status())
            except websockets.exceptions.ConnectionClosed:
                pass

        emitter_task = asyncio.create_task(status_emitter())
        try:
            async for message in websocket:
                try:
                    data = json.loads(message)
                    action = data.get("action")
                    if action == "SET_POSITION":
                        az = max(0.0, min(450.0, float(data.get("azDeg", 0.0))))
                        el = max(0.0, min(180.0, float(data.get("elDeg", 0.0))))
                        self.mock_rotator.handle_command(f"W{int(round(az)):03d} {int(round(el)):03d}")
                        await websocket.send(json.dumps({
                            "type": "LOG",
                            "text": f"SET_POSITION: AZ={az:.1f}°, EL={el:.1f}°",
                            "direction": "TX",
                        }))
                    elif action == "STOP":
                        self.mock_rotator.handle_command("S")
                        await websocket.send(json.dumps({
                            "type": "LOG",
                            "text": "EMERGENCY_STOP: Rotator axes halted",
                            "direction": "TX",
                        }))
                except (ValueError, TypeError, json.JSONDecodeError) as ex:
                    print(f"[Bridge] Bad message ignored: {ex}")
        except websockets.exceptions.ConnectionClosed:
            pass
        finally:
            emitter_task.cancel()
            print("[OrbitGuard Bridge] Client disconnected")

    async def run(self):
        print(f"[OrbitGuard Bridge] Listening on ws://{self.host}:{self.port}")
        async with websockets.serve(self.handle_client, self.host, self.port, origins=allowed_origins()):
            await asyncio.Future()


if __name__ == "__main__":
    bridge = RotatorBridge()
    try:
        asyncio.run(bridge.run())
    except KeyboardInterrupt:
        print("\n[OrbitGuard Bridge] Shutting down.")
        bridge.mock_rotator.stop()
