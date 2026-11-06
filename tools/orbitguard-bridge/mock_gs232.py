"""
OrbitGuard Mock Yaesu GS-232A/B Hardware Emulator
==================================================
Simulates physical dual-axis antenna rotator behavior over TCP socket or loopback
serial port for end-to-end hardware-in-the-loop (HIL) automated testing.
"""

import re
import time
import socket
import threading

class MockGS232Rotator:
    def __init__(self, host="127.0.0.1", port=4533):
        self.host = host
        self.port = port
        self.actual_az = 0.0
        self.actual_el = 0.0
        self.commanded_az = 0.0
        self.commanded_el = 0.0
        self.az_speed_deg_s = 6.0
        self.el_speed_deg_s = 3.5
        self.running = False
        self.server_sock = None
        self._sim_thread = None

    def start(self):
        self.running = True
        self._sim_thread = threading.Thread(target=self._run_physics, daemon=True)
        self._sim_thread.start()

    def stop(self):
        self.running = False
        if self.server_sock:
            try:
                self.server_sock.close()
            except Exception:
                pass

    def handle_command(self, raw_cmd: str) -> str:
        cmd = raw_cmd.strip().upper()

        # Stop command: S
        if cmd == "S":
            self.commanded_az = self.actual_az
            self.commanded_el = self.actual_el
            return "\r\n"

        # Position Query: C2
        if cmd == "C2":
            az_int = int(round(self.actual_az))
            el_int = int(round(self.actual_el))
            return f"+0{az_int:03d}+0{el_int:03d}\r\n"

        # Set Position: W<AAA> <EEE>
        match_w = re.match(r"^W(\d{3})\s+(\d{3})", cmd)
        if match_w:
            self.commanded_az = float(match_w.group(1))
            self.commanded_el = float(match_w.group(2))
            return "\r\n"

        # Hamlib rotctld format: P <az> <el>
        match_p = re.match(r"^P\s+([\d.]+)\s+([\d.]+)", cmd)
        if match_p:
            self.commanded_az = float(match_p.group(1))
            self.commanded_el = float(match_p.group(2))
            return "RPRT 0\n"

        # Hamlib query: p
        if cmd == "P":
            return f"{self.actual_az:.1f}\n{self.actual_el:.1f}\n"

        return "?\r\n"

    def _run_physics(self):
        last_t = time.time()
        while self.running:
            time.sleep(0.05)
            now = time.time()
            dt = now - last_t
            last_t = now

            # Step Azimuth
            d_az = self.commanded_az - self.actual_az
            if abs(d_az) > 0.05:
                step_az = (1 if d_az > 0 else -1) * min(abs(d_az), self.az_speed_deg_s * dt)
                self.actual_az += step_az

            # Step Elevation
            d_el = self.commanded_el - self.actual_el
            if abs(d_el) > 0.05:
                step_el = (1 if d_el > 0 else -1) * min(abs(d_el), self.el_speed_deg_s * dt)
                self.actual_el += step_el

if __name__ == "__main__":
    emulator = MockGS232Rotator()
    emulator.start()
    print("[Mock GS-232] Started virtual rotator emulator.")
    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        emulator.stop()
