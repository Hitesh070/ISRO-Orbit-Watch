# OrbitGuard Windows Testing & Verification

This page distinguishes automated checks from actions that require a Windows operator, network access, or physical hardware. An unexecuted manual procedure is not marked verified.

## Automated checks

Run from the repository root:

```powershell
npm test
npm run typecheck
python -m pytest tests -q
npm run package:desktop
```

`npm test` runs the frontend and Electron main-process suites. The current verified counts are listed in [`RELEASE_V5.0.md`](RELEASE_V5.0.md). The backend and packaging status must be updated from their actual command output for each release.

## Manual operator checks

### App startup and catalog freshness

1. Launch the packaged app online and confirm its source, generated time, last refresh attempt, and freshness state.
2. Launch it offline and confirm that the bundled/cache snapshot is labelled with its own source time and becomes stale when older than the configured threshold.
3. Confirm that missing catalog or screening data is shown as unavailable and is not replaced by random or fabricated metrics.

### Display scaling

On Windows 10/11, inspect the app at the display scale factors supported by the test device. Check that navigation, chart labels, modals, and the globe remain usable. Record the actual OS, resolution, scale factor, and observed result; do not report unperformed factors as verified.

### RF and location

1. Use a known, operator-supplied site location or grant GPS access only when intended.
2. Select a supported target, verified carrier frequency, and a predicted pass.
3. Confirm time basis, units, elevation mask, and source inputs before interpreting Doppler or link-budget outputs.
4. If no pass or required input is available, verify that the UI reports that state instead of displaying a synthetic result.

### Physical rotator

Test the virtual simulator first. Before connecting a real device, identify the correct COM port/protocol, verify hard stops and mechanical limits, confirm the emergency-stop path, and keep the antenna clear of obstructions. Record actual device and firmware details. Automated serial safety tests do not prove a particular installation's hardware is safe.

## Current v5.0 manual review

See [`RELEASE_V5.0.md`](RELEASE_V5.0.md) for the completed section-by-section mouse review and its limits. No physical rotator movement, GPS acquisition, high-DPI matrix, or offline-network test is claimed there unless explicitly recorded.
