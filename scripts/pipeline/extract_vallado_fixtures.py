"""
Extract official Vallado SGP4 verification test vectors into tests/fixtures/vallado_cases.json
Source: David Vallado, Paul Crawford, Richard Hujsak, and T.S. Kelso,
"Revisiting Spacetrack Report #3," AIAA 2006-6753, 2006.
"""

import json
from pathlib import Path

import sgp4
from sgp4.api import Satrec

p = Path(sgp4.__file__).parent
tle_path = p / "SGP4-VER.TLE"
out_path = p / "tcppver.out"

with open(tle_path, "r", encoding="utf-8") as f:
    tle_lines = [line.strip() for line in f if line.strip()]

tles = {}
i = 0
while i < len(tle_lines):
    line = tle_lines[i]
    if line.startswith("1 "):
        line1 = line
        line2 = tle_lines[i + 1]
        satnum = int(line1[2:7])
        tles[satnum] = (line1[:69], line2[:69])
        i += 2
    else:
        i += 1

with open(out_path, "r", encoding="utf-8") as f:
    out_lines = f.readlines()

valid_cases = []
error_cases = []
current_sat = None
seen = set()

for line in out_lines:
    parts = line.strip().split()
    if not parts:
        continue
    if len(parts) == 2 and parts[1] == "xx":
        current_sat = int(parts[0])
    elif len(parts) >= 7 and current_sat in tles:
        tsince = float(parts[0])
        # Sample key time intervals: 0, 360, 720, 1440, 2880 minutes
        if tsince in [0.0, 360.0, 720.0, 1440.0, 2880.0]:
            r = [float(parts[1]), float(parts[2]), float(parts[3])]
            v = [float(parts[4]), float(parts[5]), float(parts[6])]

            # Verify against sgp4 library to determine if this point is an error state
            line1, line2 = tles[current_sat]
            satrec = Satrec.twoline2rv(line1, line2)
            e, r_calc, v_calc = satrec.sgp4_tsince(tsince)

            case_data = {
                "satnum": current_sat,
                "line1": line1,
                "line2": line2,
                "tsince_min": tsince,
                "expected_r_km": r,
                "expected_v_km_s": v,
                "expected_error": e,
            }

            if (current_sat, tsince) in seen:  # reference output repeats some epochs
                continue
            seen.add((current_sat, tsince))
            if e == 0:
                valid_cases.append(case_data)
            else:
                error_cases.append(case_data)

fixtures_dir = Path("tests/fixtures")
fixtures_dir.mkdir(parents=True, exist_ok=True)

output_file = fixtures_dir / "vallado_cases.json"
with open(output_file, "w", encoding="utf-8") as f:
    json.dump({"valid_cases": valid_cases, "error_cases": error_cases}, f, indent=2)

# Also write to frontend fixtures
fe_fixtures = Path("frontend/src/tests/fixtures")
fe_fixtures.mkdir(parents=True, exist_ok=True)
with open(fe_fixtures / "vallado_cases.json", "w", encoding="utf-8") as f:
    json.dump({"valid_cases": valid_cases, "error_cases": error_cases}, f, indent=2)

print(f"Extracted {len(valid_cases)} valid cases and {len(error_cases)} error cases.")
