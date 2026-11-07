/**
 * OrbitGuard ESP32 Dual-Axis Antenna Rotator Controller
 * Yaesu GS-232A/B protocol over serial; AccelStepper trapezoidal motion; TMC2209/A4988 step/dir.
 *
 * steps_per_deg = (200 * 16 * 60) / 360 = 533.333
 *
 * Limit/home switches (active LOW, INPUT_PULLUP) define position 0 when pressed while moving
 * toward lower angles. NOTE: AS5600 closed-loop feedback is not implemented (open-loop steps).
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
const float ACCEL_DEG_S2 = 4.0f;
const unsigned long WATCHDOG_TIMEOUT_MS = 15000;
const size_t MAX_LINE = 48;

AccelStepper stepperAz(AccelStepper::DRIVER, PIN_AZ_STEP, PIN_AZ_DIR);
AccelStepper stepperEl(AccelStepper::DRIVER, PIN_EL_STEP, PIN_EL_DIR);

unsigned long lastCmdTimestamp = 0;
bool watchdogTripped = false;
String serialBuffer = "";

void setupMotors() {
    pinMode(PIN_AZ_ENABLE, OUTPUT);
    pinMode(PIN_EL_ENABLE, OUTPUT);
    digitalWrite(PIN_AZ_ENABLE, LOW);  // active LOW
    digitalWrite(PIN_EL_ENABLE, LOW);
    pinMode(PIN_AZ_HOME_SW, INPUT_PULLUP);
    pinMode(PIN_EL_HOME_SW, INPUT_PULLUP);

    stepperAz.setMaxSpeed(MAX_SPEED_DEG_S_AZ * STEPS_PER_DEG);
    stepperAz.setAcceleration(ACCEL_DEG_S2 * STEPS_PER_DEG);
    stepperEl.setMaxSpeed(MAX_SPEED_DEG_S_EL * STEPS_PER_DEG);
    stepperEl.setAcceleration(ACCEL_DEG_S2 * STEPS_PER_DEG);
}

void handleHomeSwitch(AccelStepper &st, int pin) {
    // Pressed while heading to lower angles -> this is angle 0; stop and re-reference.
    if (digitalRead(pin) == LOW && st.targetPosition() < st.currentPosition() + 1 && st.speed() <= 0) {
        st.setCurrentPosition(0);
        st.moveTo(0);
    }
}

void parseCommand(const String &cmd) {
    lastCmdTimestamp = millis();
    watchdogTripped = false;
    String s = cmd;
    s.trim();
    s.toUpperCase();

    if (s.startsWith("S")) {
        stepperAz.stop();
        stepperEl.stop();
        Serial.print("\r\n");
        return;
    }

    if (s.startsWith("C")) {  // C or C2: report position (az stays 0..MAX_AZ, no modulo on 450-deg rotators)
        float curAz = constrain(stepperAz.currentPosition() / STEPS_PER_DEG, 0.0f, (float)ROTATOR_MAX_AZ);
        float curEl = constrain(stepperEl.currentPosition() / STEPS_PER_DEG, 0.0f, (float)ROTATOR_MAX_EL);
        char buf[32];
        snprintf(buf, sizeof(buf), "+0%03d+0%03d\r\n", (int)roundf(curAz), (int)roundf(curEl));
        Serial.print(buf);
        return;
    }

    if (s.startsWith("W")) {  // W<AAA> <EEE>
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
    Serial.println("OrbitGuard ESP32 Rotator Controller v1.1 Ready");
}

void loop() {
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
            serialBuffer = "";  // overlong garbage line: drop it
        }
    }

    if (!watchdogTripped && millis() - lastCmdTimestamp > WATCHDOG_TIMEOUT_MS &&
        (stepperAz.distanceToGo() != 0 || stepperEl.distanceToGo() != 0)) {
        stepperAz.stop();
        stepperEl.stop();
        watchdogTripped = true;  // trip once instead of re-issuing stop() every loop
    }

    handleHomeSwitch(stepperAz, PIN_AZ_HOME_SW);
    handleHomeSwitch(stepperEl, PIN_EL_HOME_SW);

    stepperAz.run();
    stepperEl.run();
}
