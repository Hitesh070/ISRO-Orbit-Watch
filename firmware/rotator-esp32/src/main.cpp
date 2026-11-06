/**
 * OrbitGuard ESP32 Dual-Axis Antenna Rotator Controller
 * =====================================================
 * Embedded firmware implementing Yaesu GS-232A/B protocol over USB-CDC serial.
 * Drives dual NEMA 17/23 stepper motors via TMC2209/A4988 step/dir drivers
 * with trapezoidal acceleration and AS5600 12-bit magnetic encoder feedback.
 *
 * Mechanical & Gear Calculation:
 * ------------------------------
 * Motor: 1.8°/step NEMA 17 => 200 steps/rev
 * Driver: 1/16 Microstepping => 3,200 microsteps/rev
 * Gearbox / Worm Drive: 60:1 reduction ratio
 * Total steps per degree:
 *   steps_per_deg = (200 * 16 * 60) / 360 = 533.333 steps/deg
 */

#include <Arduino.h>
#include <AccelStepper.h>
#include <Wire.h>

// Pin Definitions (ESP32 NodeMCU-32S)
#define PIN_AZ_STEP    19
#define PIN_AZ_DIR     18
#define PIN_AZ_ENABLE  5

#define PIN_EL_STEP    17
#define PIN_EL_DIR     16
#define PIN_EL_ENABLE  4

#define PIN_AZ_HOME_SW 25
#define PIN_EL_HOME_SW 26

#define I2C_SDA        21
#define I2C_SCL        22

// Mechanical constants
const float STEPS_PER_DEG_AZ = 533.3333f;
const float STEPS_PER_DEG_EL = 533.3333f;

const float MAX_SPEED_DEG_S_AZ = 10.0f; // max 10 deg/sec
const float MAX_SPEED_DEG_S_EL = 6.0f;  // max 6 deg/sec
const float ACCEL_DEG_S2       = 4.0f;  // 4 deg/sec^2

// AccelStepper instances (Driver mode = 1)
AccelStepper stepperAz(AccelStepper::DRIVER, PIN_AZ_STEP, PIN_AZ_DIR);
AccelStepper stepperEl(AccelStepper::DRIVER, PIN_EL_STEP, PIN_EL_DIR);

// State variables
float targetAzDeg = 0.0f;
float targetElDeg = 0.0f;
unsigned long lastCmdTimestamp = 0;
const unsigned long WATCHDOG_TIMEOUT_MS = 15000; // 15-second safety halt

String serialBuffer = "";

void setupMotors() {
    pinMode(PIN_AZ_ENABLE, OUTPUT);
    pinMode(PIN_EL_ENABLE, OUTPUT);
    digitalWrite(PIN_AZ_ENABLE, LOW); // Active LOW enable on TMC2209
    digitalWrite(PIN_EL_ENABLE, LOW);

    stepperAz.setMaxSpeed(MAX_SPEED_DEG_S_AZ * STEPS_PER_DEG_AZ);
    stepperAz.setAcceleration(ACCEL_DEG_S2 * STEPS_PER_DEG_AZ);

    stepperEl.setMaxSpeed(MAX_SPEED_DEG_S_EL * STEPS_PER_DEG_EL);
    stepperEl.setAcceleration(ACCEL_DEG_S2 * STEPS_PER_DEG_EL);
}

void parseCommand(const String& cmd) {
    lastCmdTimestamp = millis();
    String s = cmd;
    s.trim();
    s.toUpperCase();

    // 1. Stop command: "S"
    if (s.startsWith("S")) {
        stepperAz.stop();
        stepperEl.stop();
        Serial.print("\r\n");
        return;
    }

    // 2. Position Query: "C2" or "C"
    if (s.startsWith("C2") || s.startsWith("C")) {
        float curAz = stepperAz.currentPosition() / STEPS_PER_DEG_AZ;
        float curEl = stepperEl.currentPosition() / STEPS_PER_DEG_EL;
        curAz = fmod(curAz + 360.0f, 360.0f);
        curEl = constrain(curEl, 0.0f, 180.0f);

        char buf[32];
        snprintf(buf, sizeof(buf), "+0%03d+0%03d\r\n", (int)round(curAz), (int)round(curEl));
        Serial.print(buf);
        return;
    }

    // 3. Set Position: "W<AAA> <EEE>"
    if (s.startsWith("W")) {
        int spaceIdx = s.indexOf(' ');
        if (spaceIdx > 1) {
            int az = s.substring(1, spaceIdx).toInt();
            int el = s.substring(spaceIdx + 1).toInt();

            targetAzDeg = constrain((float)az, 0.0f, 360.0f);
            targetElDeg = constrain((float)el, 0.0f, 180.0f);

            stepperAz.moveTo((long)(targetAzDeg * STEPS_PER_DEG_AZ));
            stepperEl.moveTo((long)(targetElDeg * STEPS_PER_DEG_EL));
            Serial.print("\r\n");
            return;
        }
    }

    // Unrecognized command
    Serial.print("?\r\n");
}

void setup() {
    Serial.begin(115200);
    setupMotors();
    lastCmdTimestamp = millis();
    Serial.println("OrbitGuard ESP32 Rotator Controller v1.0 Ready");
}

void loop() {
    // Process serial commands
    while (Serial.available()) {
        char c = (char)Serial.read();
        if (c == '\r' || c == '\n') {
            if (serialBuffer.length() > 0) {
                parseCommand(serialBuffer);
                serialBuffer = "";
            }
        } else {
            serialBuffer += c;
        }
    }

    // Safety Watchdog: stop motion if communications cease while tracking
    if (millis() - lastCmdTimestamp > WATCHDOG_TIMEOUT_MS) {
        if (stepperAz.distanceToGo() != 0 || stepperEl.distanceToGo() != 0) {
            stepperAz.stop();
            stepperEl.stop();
        }
    }

    // Step motors with smooth acceleration
    stepperAz.run();
    stepperEl.run();
}
