#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>

/*
  ESP32 report alert notifier

  Firebase RTDB path expected:
    /deviceAlerts/latest

  Example payload:
  {
    "reportId": "abc123",
    "severity": "critical",
    "timestamp": 1739871000
  }

  Supported severity values:
    - critical: long tone
    - urgent: long + short beep + long
    - moderate: 3 short beeps

  Common-cathode RGB LED behavior:
    - critical: solid red
    - urgent: orange pulse during pattern
    - moderate: yellow blink with each beep
*/

// Wi-Fi
const char* WIFI_SSID = "YOUR_WIFI_SSID";
const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";

// Firebase RTDB URL, no trailing slash
const char* FIREBASE_RTD_URL = "https://YOUR_PROJECT_ID-default-rtdb.firebaseio.com";

// Optional: database auth token if rules require auth. Leave empty if public read is allowed for this path.
const char* FIREBASE_AUTH_TOKEN = "";

// Hardware pins
const int BUZZER_PIN = 25;
const int LED_R_PIN = 14;
const int LED_G_PIN = 12;
const int LED_B_PIN = 13;

// PWM channels (ESP32)
const int BUZZER_CH = 0;
const int LED_R_CH = 1;
const int LED_G_CH = 2;
const int LED_B_CH = 3;

const uint32_t POLL_INTERVAL_MS = 2000;

String lastAlertKey = "";
unsigned long lastPollMs = 0;

void connectWiFi() {
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
  }
}

void setLed(uint8_t r, uint8_t g, uint8_t b) {
  // Common cathode: higher duty = brighter
  ledcWrite(LED_R_CH, r);
  ledcWrite(LED_G_CH, g);
  ledcWrite(LED_B_CH, b);
}

void buzzerOn(uint16_t freqHz) {
  ledcWriteTone(BUZZER_CH, freqHz);
}

void buzzerOff() {
  ledcWriteTone(BUZZER_CH, 0);
}

void playToneWithLed(uint16_t freqHz, uint32_t onMs, uint32_t offMs, uint8_t r, uint8_t g, uint8_t b) {
  setLed(r, g, b);
  buzzerOn(freqHz);
  delay(onMs);
  buzzerOff();
  setLed(0, 0, 0);
  if (offMs > 0) {
    delay(offMs);
  }
}

void playCriticalPattern() {
  // Long tone
  playToneWithLed(1600, 1400, 350, 255, 0, 0);
}

void playUrgentPattern() {
  // Long + short + long
  playToneWithLed(1500, 1000, 180, 255, 80, 0);
  playToneWithLed(1900, 180, 180, 255, 110, 0);
  playToneWithLed(1500, 1000, 350, 255, 80, 0);
}

void playModeratePattern() {
  // 3 short beeps
  for (int i = 0; i < 3; i++) {
    playToneWithLed(1400, 180, 160, 255, 180, 0);
  }
  delay(300);
}

String extractSeverity(JsonDocument& doc) {
  String severity = doc["severity"] | "";
  if (severity.length() == 0) {
    severity = doc["urgency"] | "";
  }
  if (severity.length() == 0) {
    severity = doc["urgencyLevel"] | "";
  }

  severity.toLowerCase();
  if (severity != "critical" && severity != "urgent" && severity != "moderate") {
    severity = "moderate";
  }
  return severity;
}

bool fetchLatestAlert(String& outKey, String& outSeverity) {
  if (WiFi.status() != WL_CONNECTED) {
    connectWiFi();
    if (WiFi.status() != WL_CONNECTED) {
      return false;
    }
  }

  String url = String(FIREBASE_RTD_URL) + "/deviceAlerts/latest.json";
  if (strlen(FIREBASE_AUTH_TOKEN) > 0) {
    url += "?auth=" + String(FIREBASE_AUTH_TOKEN);
  }

  WiFiClientSecure client;
  client.setInsecure();

  HTTPClient http;
  if (!http.begin(client, url)) {
    return false;
  }

  int code = http.GET();
  if (code != HTTP_CODE_OK) {
    http.end();
    return false;
  }

  String payload = http.getString();
  http.end();

  if (payload == "null" || payload.length() == 0) {
    return false;
  }

  StaticJsonDocument<512> doc;
  DeserializationError err = deserializeJson(doc, payload);
  if (err) {
    return false;
  }

  String reportId = doc["reportId"] | "";
  String timestamp = doc["timestamp"] | "";
  String pushedAt = doc["pushedAt"] | "";

  outKey = reportId;
  if (outKey.length() == 0) {
    outKey = timestamp;
  }
  if (outKey.length() == 0) {
    outKey = pushedAt;
  }

  if (outKey.length() == 0) {
    return false;
  }

  outSeverity = extractSeverity(doc);
  return true;
}

void handleSeverity(const String& severity) {
  if (severity == "critical") {
    playCriticalPattern();
  } else if (severity == "urgent") {
    playUrgentPattern();
  } else {
    playModeratePattern();
  }

  setLed(0, 0, 0);
  buzzerOff();
}

void setup() {
  ledcSetup(BUZZER_CH, 2000, 8);
  ledcAttachPin(BUZZER_PIN, BUZZER_CH);

  ledcSetup(LED_R_CH, 5000, 8);
  ledcSetup(LED_G_CH, 5000, 8);
  ledcSetup(LED_B_CH, 5000, 8);
  ledcAttachPin(LED_R_PIN, LED_R_CH);
  ledcAttachPin(LED_G_PIN, LED_G_CH);
  ledcAttachPin(LED_B_PIN, LED_B_CH);

  setLed(0, 0, 0);
  buzzerOff();

  connectWiFi();
}

void loop() {
  const unsigned long now = millis();
  if (now - lastPollMs < POLL_INTERVAL_MS) {
    return;
  }

  lastPollMs = now;

  String alertKey;
  String severity;
  if (!fetchLatestAlert(alertKey, severity)) {
    return;
  }

  if (alertKey == lastAlertKey) {
    return;
  }

  lastAlertKey = alertKey;
  handleSeverity(severity);
}
