/**
 * OrbitGuard ESP32 Dual-Axis Antenna Rotator Controller
 * =======================================================
 * Yaesu GS-232A/B protocol over serial; AccelStepper trapezoidal motion; TMC2209/A4988 step/dir.
 *
 * Steps per degree = (200 * 16 * 60) / 360 = 533.3333 steps/deg.
 *
 * Safety & Homing State Machine (Phase 5 / P0 Safety Compliance):
 *  - System states: STATE_UNHOMED, STATE_HOMING, STATE_READY, STATE_FAULT
 *  - On boot, drivers begin disabled until homing starts.
 *  - Slow homing seek (1.5 deg/s) towards home switches with 45-second travel timeout.
 *  - Backoff recovery if switch is already depressed at power-on.
 *  - Rejects W<az> <el> position commands until physical homing completes (returns ERR NOT_HOMED).
 *  - Real-time limit switch supervision stops motion if lower bound is breached.
 *  - 15-second communications loss watchdog timer and emergency stop.
 */

#include <Arduino.h>
#include <AccelStepper.h>

#ifndef ROTATOR_MAX_AZ
#define ROTATOR_MAX_AZ 450
#endif
#ifndef ROTATOR_MAX_EL
#define ROTATOR_MAX_EL 180
#endif

#define PIN_AZ_STEP    19
#define PIN_AZ_DIR     18
#define PIN_AZ_ENABLE  5
#define PIN_EL_STEP    17
#define PIN_EL_DIR     16
#define PIN_EL_ENABLE  4
#define PIN_AZ_HOME_SW 25
#define PIN_EL_HOME_SW 26

const float STEPS_PER_DEG = 533.3333f;
const float MAX_SPEED_DEG_S_AZ = 10.0f;
const float MAX_SPEED_DEG_S_EL = 6.0f;
const float HOMING_SPEED_DEG_S = 2.0f;
const float ACCEL_DEG_S2 = 4.0f;
const unsigned long WATCHDOG_TIMEOUT_MS = 15000;
const unsigned long HOMING_TIMEOUT_MS = 45000;
const size_t MAX_LINE = 48;

enum RotatorState {
    STATE_UNHOMED,
    STATE_HOMING,
    STATE_READY,
    STATE_FAULT
};

AccelStepper stepperAz(AccelStepper::DRIVER, PIN_AZ_STEP, PIN_AZ_DIR);
AccelStepper stepperEl(AccelStepper::DRIVER, PIN_EL_STEP, PIN_EL_DIR);

RotatorState currentState = STATE_UNHOMED;
unsigned long lastCmdTimestamp = 0;
unsigned long homingStartTimestamp = 0;
bool watchdogTripped = false;
bool azHomed = false;
bool elHomed = false;
String serialBuffer = "";

void enableMotors(bool enable) {
    // TMC2209 / A4988 active LOW enable
    digitalWrite(PIN_AZ_ENABLE, enable ? LOW : HIGH);
    digitalWrite(PIN_EL_ENABLE, enable ? LOW : HIGH);
}

void startHoming() {
    Serial.println("STATUS HOMING_INIT");
    currentState = STATE_HOMING;
    azHomed = false;
    elHomed = false;
    homingStartTimestamp = millis();

    enableMotors(true);

    // Set gentle homing speeds
    stepperAz.setMaxSpeed(HOMING_SPEED_DEG_S * STEPS_PER_DEG);
    stepperAz.setAcceleration(ACCEL_DEG_S2 * STEPS_PER_DEG);
    stepperEl.setMaxSpeed(HOMING_SPEED_DEG_S * STEPS_PER_DEG);
    stepperEl.setAcceleration(ACCEL_DEG_S2 * STEPS_PER_DEG);

    // If switch already depressed, back off by +5 degrees first
    if (digitalRead(PIN_AZ_HOME_SW) == LOW) {
        stepperAz.setCurrentPosition(0);
        stepperAz.moveTo((long)(5.0f * STEPS_PER_DEG));
    } else {
        stepperAz.moveTo((long)(-500.0f * STEPS_PER_DEG));
    }

    if (digitalRead(PIN_EL_HOME_SW) == LOW) {
        stepperEl.setCurrentPosition(0);
        stepperEl.moveTo((long)(5.0f * STEPS_PER_DEG));
    } else {
        stepperEl.moveTo((long)(-200.0f * STEPS_PER_DEG));
    }
}

void setupMotors() {
    pinMode(PIN_AZ_ENABLE, OUTPUT);
    pinMode(PIN_EL_ENABLE, OUTPUT);
    enableMotors(false); // Begin disabled until homed

    pinMode(PIN_AZ_HOME_SW, INPUT_PULLUP);
    pinMode(PIN_EL_HOME_SW, INPUT_PULLUP);

    stepperAz.setMaxSpeed(MAX_SPEED_DEG_S_AZ * STEPS_PER_DEG);
    stepperAz.setAcceleration(ACCEL_DEG_S2 * STEPS_PER_DEG);
    stepperEl.setMaxSpeed(MAX_SPEED_DEG_S_EL * STEPS_PER_DEG);
    stepperEl.setAcceleration(ACCEL_DEG_S2 * STEPS_PER_DEG);
}

void finishHomingIfComplete() {
    if (azHomed && elHomed) {
        currentState = STATE_READY;
        // Restore operational tracking speeds
        stepperAz.setMaxSpeed(MAX_SPEED_DEG_S_AZ * STEPS_PER_DEG);
        stepperEl.setMaxSpeed(MAX_SPEED_DEG_S_EL * STEPS_PER_DEG);
        Serial.println("STATUS HOMED_READY");
    }
}

void parseCommand(const String &cmd) {
    lastCmdTimestamp = millis();
    watchdogTripped = false;
    String s = cmd;
    s.trim();
    s.toUpperCase();

    // Emergency Stop
    if (s.startsWith("S")) {
        stepperAz.stop();
        stepperEl.stop();
        Serial.print("\r\n");
        return;
    }

    // Trigger Homing
    if (s.startsWith("H")) {
        startHoming();
        Serial.print("HOMING\r\n");
        return;
    }

    // Reset Fault
    if (s.startsWith("R")) {
        startHoming();
        return;
    }

    // Position Query (C or C2)
    if (s.startsWith("C")) {
        float curAz = constrain(stepperAz.currentPosition() / STEPS_PER_DEG, 0.0f, (float)ROTATOR_MAX_AZ);
        float curEl = constrain(stepperEl.currentPosition() / STEPS_PER_DEG, 0.0f, (float)ROTATOR_MAX_EL);
        char buf[32];
        snprintf(buf, sizeof(buf), "+0%03d+0%03d\r\n", (int)roundf(curAz), (int)roundf(curEl));
        Serial.print(buf);
        return;
    }

    // Position Command (W<AAA> <EEE>)
    if (s.startsWith("W")) {
        // Enforce physical homing safety check
        if (currentState != STATE_READY) {
            Serial.print("ERR NOT_HOMED\r\n");
            return;
        }

        int spaceIdx = s.indexOf(' ');
        if (spaceIdx > 1) {
            float az = constrain((float)s.substring(1, spaceIdx).toInt(), 0.0f, (float)ROTATOR_MAX_AZ);
            float el = constrain((float)s.substring(spaceIdx + 1).toInt(), 0.0f, (float)ROTATOR_MAX_EL);
            stepperAz.moveTo((long)(az * STEPS_PER_DEG));
            stepperEl.moveTo((long)(el * STEPS_PER_DEG));
            Serial.print("\r\n");
            return;
        }
    }

    Serial.print("?\r\n");
}

void setup() {
    Serial.begin(115200);
    setupMotors();
    lastCmdTimestamp = millis();
    Serial.println("OrbitGuard ESP32 Rotator Controller v1.2 Ready");
    startHoming();
}

void loop() {
    // Process incoming serial commands
    while (Serial.available()) {
        char c = (char)Serial.read();
        if (c == '\r' || c == '\n') {
            if (serialBuffer.length() > 0) {
                parseCommand(serialBuffer);
                serialBuffer = "";
            }
        } else if (serialBuffer.length() < MAX_LINE) {
            serialBuffer += c;
        } else {
            serialBuffer = "";  // drop overlong lines
        }
    }

    // Homing state supervision
    if (currentState == STATE_HOMING) {
        // Check timeout
        if (millis() - homingStartTimestamp > HOMING_TIMEOUT_MS) {
            stepperAz.stop();
            stepperEl.stop();
            enableMotors(false);
            currentState = STATE_FAULT;
            Serial.println("ERR HOMING_TIMEOUT");
            return;
        }

        // Azimuth switch check
        if (!azHomed) {
            if (digitalRead(PIN_AZ_HOME_SW) == LOW && stepperAz.speed() <= 0) {
                stepperAz.stop();
                stepperAz.setCurrentPosition(0);
                stepperAz.moveTo(0);
                azHomed = true;
            }
        }

        // Elevation switch check
        if (!elHomed) {
            if (digitalRead(PIN_EL_HOME_SW) == LOW && stepperEl.speed() <= 0) {
                stepperEl.stop();
                stepperEl.setCurrentPosition(0);
                stepperEl.moveTo(0);
                elHomed = true;
            }
        }

        finishHomingIfComplete();
    } else if (currentState == STATE_READY) {
        // Limit switch protection during normal operations:
        // Stop if axis attempts to drive past home switch in negative direction
        if (digitalRead(PIN_AZ_HOME_SW) == LOW && stepperAz.speed() < 0) {
            stepperAz.stop();
            stepperAz.setCurrentPosition(0);
        }
        if (digitalRead(PIN_EL_HOME_SW) == LOW && stepperEl.speed() < 0) {
            stepperEl.stop();
            stepperEl.setCurrentPosition(0);
        }

        // Communications Watchdog Timer (15s)
        if (!watchdogTripped && millis() - lastCmdTimestamp > WATCHDOG_TIMEOUT_MS &&
            (stepperAz.distanceToGo() != 0 || stepperEl.distanceToGo() != 0)) {
            stepperAz.stop();
            stepperEl.stop();
            watchdogTripped = true;
        }
    }

    // Advance motor steps
    if (currentState == STATE_HOMING || currentState == STATE_READY) {
        stepperAz.run();
        stepperEl.run();
    }
}
