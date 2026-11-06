# Security Policy & Responsible Disclosure

## Supported Versions
OrbitGuard actively maintains and secures the following versions:

| Version | Supported          |
| ------- | ------------------ |
| 4.x     | :white_check_mark: |
| 3.x     | :white_check_mark: |
| < 3.0   | :x:                |

## Reporting a Vulnerability
We take the security of spaceflight telemetry and ground station command interfaces seriously.

1. **Do not create public GitHub issues for security vulnerabilities.**
2. Send an email describing the vulnerability, proof of concept, and affected components to the repository maintainer or open a private advisory on GitHub Security Advisories.
3. We will respond within 48 hours to confirm receipt and provide an estimated remediation timeline.

## Ground Station & Telemetry Security Posture
- **No Client Secrets**: OrbitGuard does not store or leak Space-Track credentials or private API keys in client-side bundles.
- **Local Bridge Isolation**: The local hardware rotator bridge daemon (`tools/orbitguard-bridge`) binds strictly to `127.0.0.1` and validates origin headers to prevent malicious cross-origin websites from commanding antenna movement.
- **Client Geolocation Privacy**: Observer GPS coordinates remain strictly in browser `localStorage` and are never uploaded or tracked on backend servers.
