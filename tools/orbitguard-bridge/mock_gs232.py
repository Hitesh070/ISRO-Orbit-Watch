"""
OrbitGuard Mock Yaesu GS-232A/B Hardware Emulator
==================================================
Simulates a dual-axis rotator (azimuth 0-450 deg, elevation 0-180 deg) for hardware-in-the-loop
testing. `handle_command` is the protocol surface used by the bridge and by tests.
"""

import re
import threading
import time

MAX_AZ = 450.0
MAX_EL = 180.0


class MockGS232Rotator:
    def __init__(self):
        self.actual_az = 0.0
        self.actual_el = 0.0
        self.commanded_az = 0.0
        self.commanded_el = 0.0
        self.az_speed_deg_s = 6.0
        self.el_speed_deg_s = 3.5
        self.running = False
        self._sim_thread = None
        self._lock = threading.Lock()

    def start(self):
        if self.running:
            return
        self.running = True
        self._sim_thread = threading.Thread(target=self._run_physics, daemon=True)
        self._sim_thread.start()

    def stop(self):
        self.running = False

    def handle_command(self, raw_cmd: str) -> str:
        cmd = raw_cmd.strip().upper()

        if cmd == "S":
            with self._lock:
                self.commanded_az, self.commanded_el = self.actual_az, self.actual_el
            return "\r\n"

        if cmd in ("C2", "C"):
            with self._lock:
                az, el = int(round(self.actual_az)), int(round(self.actual_el))
            return f"+0{az:03d}+0{el:03d}\r\n"

        m = re.match(r"^W(\d{3})\s+(\d{3})", cmd)
        if m:
            with self._lock:
                self.commanded_az = min(MAX_AZ, float(m.group(1)))
                self.commanded_el = min(MAX_EL, float(m.group(2)))
            return "\r\n"

        # Hamlib rotctld: "P <az> <el>" (set) and "p" (get). Case matters, so match on the raw text.
        raw = raw_cmd.strip()
        m = re.match(r"^P\s+([\d.]+)\s+([\d.]+)", raw)
        if m:
            with self._lock:
                self.commanded_az = min(MAX_AZ, float(m.group(1)))
                self.commanded_el = min(MAX_EL, float(m.group(2)))
            return "RPRT 0\n"
        if raw == "p":
            with self._lock:
                return f"{self.actual_az:.1f}\n{self.actual_el:.1f}\n"

        return "?\r\n"

    def _run_physics(self):
        last_t = time.time()
        while self.running:
            time.sleep(0.05)
            now = time.time()
            dt = now - last_t
            last_t = now
            with self._lock:
                for attr, cmd_attr, speed in (
                    ("actual_az", "commanded_az", self.az_speed_deg_s),
                    ("actual_el", "commanded_el", self.el_speed_deg_s),
                ):
                    delta = getattr(self, cmd_attr) - getattr(self, attr)
                    if abs(delta) > 0.05:
                        step = (1 if delta > 0 else -1) * min(abs(delta), speed * dt)
                        setattr(self, attr, getattr(self, attr) + step)


if __name__ == "__main__":
    emulator = MockGS232Rotator()
    emulator.start()
    print("[Mock GS-232] Started virtual rotator emulator.")
    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        emulator.stop()
