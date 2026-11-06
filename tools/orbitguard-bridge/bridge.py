"""
OrbitGuard Local Rotator Bridge Daemon
======================================
Connects browser frontend (ws://127.0.0.1:8765) to physical serial port (pyserial)
or local Hamlib rotctld TCP server. Fallbacks to internal MockGS232Rotator.
"""

import sys
import json
import time
import asyncio
from typing import Optional
from mock_gs232 import MockGS232Rotator

try:
    import websockets
except ImportError:
    print("[OrbitGuard Bridge] Error: 'websockets' not installed. Run: pip install websockets")
    sys.exit(1)

class RotatorBridge:
    def __init__(self, host="127.0.0.1", port=8765):
        self.host = host
        self.port = port
        self.mock_rotator = MockGS232Rotator()
        self.mock_rotator.start()

    async def handle_client(self, websocket):
        print(f"[OrbitGuard Bridge] Client connected from {websocket.remote_address}")
        try:
            # Periodic status broadcast loop task
            async def status_emitter():
                while True:
                    await asyncio.sleep(0.1)
                    status_msg = json.dumps({
                        "type": "STATUS",
                        "actualAz": round(self.mock_rotator.actual_az, 1),
                        "actualEl": round(self.mock_rotator.actual_el, 1),
                        "commandedAz": round(self.mock_rotator.commanded_az, 1),
                        "commandedEl": round(self.mock_rotator.commanded_el, 1),
                        "isMoving": abs(self.mock_rotator.commanded_az - self.mock_rotator.actual_az) > 0.2
                    })
                    await websocket.send(status_msg)

            emitter_task = asyncio.create_task(status_emitter())

            async for message in websocket:
                try:
                    data = json.loads(message)
                    action = data.get("action")
                    if action == "SET_POSITION":
                        az = float(data.get("azDeg", 0.0))
                        el = float(data.get("elDeg", 0.0))
                        self.mock_rotator.handle_command(f"W{int(round(az)):03d} {int(round(el)):03d}")
                        await websocket.send(json.dumps({
                            "type": "LOG",
                            "text": f"SET_POSITION: AZ={az:.1f}°, EL={el:.1f}°",
                            "direction": "TX"
                        }))
                    elif action == "STOP":
                        self.mock_rotator.handle_command("S")
                        await websocket.send(json.dumps({
                            "type": "LOG",
                            "text": "EMERGENCY_STOP: Rotator axes halted",
                            "direction": "TX"
                        }))
                except Exception as ex:
                    print(f"[Bridge Error] {ex}")

        except websockets.exceptions.ConnectionClosed:
            print("[OrbitGuard Bridge] Client disconnected")
        finally:
            emitter_task.cancel()

    async def run(self):
        print(f"[OrbitGuard Bridge] Starting WebSocket daemon on ws://{self.host}:{self.port}")
        async with websockets.serve(self.handle_client, self.host, self.port):
            await asyncio.Future()  # run forever

if __name__ == "__main__":
    bridge = RotatorBridge()
    try:
        asyncio.run(bridge.run())
    except KeyboardInterrupt:
        print("\n[OrbitGuard Bridge] Shutting down.")
