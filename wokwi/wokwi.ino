#include <Arduino.h>
#include <WiFi.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>
#include <DHT.h>
#include <ESP32Servo.h>

#define DHT_PIN 12
#define DHT_TYPE DHT22
#define LDR_PIN 34
#define PRESSURE_PIN 35

const char* WIFI_SSID = "Wokwi-GUEST";
const char* WIFI_PASSWORD = "";
const char* MQTT_SERVER = "host.wokwi.internal";
const int MQTT_PORT = 1883;
const char* TELEMETRY_TOPIC = "industria40/sensores";
const char* COMMAND_TOPIC = "industria40/atuadores";

const int SERVO_PINS[4] = {15, 18, 19, 21};
const char* DEVICE_ID = "esp32-industria-01";

WiFiClient wifiClient;
PubSubClient mqttClient(wifiClient);
DHT dht(DHT_PIN, DHT_TYPE);
Servo servos[4];

bool motorState[4] = {false, false, false, false};
int servoAngle[4] = {90, 90, 90, 90};
int servoDirection[4] = {1, 1, 1, 1};

unsigned long lastTelemetry = 0;
unsigned long lastServoStep = 0;
float lastTemperature = 25.0;
float lastHumidity = 55.0;

void connectWifi() {
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  Serial.print("Conectando ao WiFi");
  while (WiFi.status() != WL_CONNECTED) {
    delay(250);
    Serial.print(".");
  }
  Serial.println();
  Serial.print("WiFi conectado: ");
  Serial.println(WiFi.localIP());
}

void applyMotorCommand(int motor, bool state) {
  if (motor < 1 || motor > 4) return;

  int index = motor - 1;
  motorState[index] = state;

  if (!state) {
    servoAngle[index] = 90;
    servos[index].write(90);
  }

  Serial.print("Motor ");
  Serial.print(motor);
  Serial.println(state ? " ligado" : " desligado");
}

void onMqttMessage(char* topic, byte* payload, unsigned int length) {
  String message;
  for (unsigned int i = 0; i < length; i++) {
    message += (char)payload[i];
  }

  Serial.print("Comando MQTT recebido em ");
  Serial.print(topic);
  Serial.print(": ");
  Serial.println(message);

  StaticJsonDocument<192> doc;
  DeserializationError error = deserializeJson(doc, message);
  if (error) {
    Serial.println("JSON de comando invalido");
    return;
  }

  int motor = doc["motor"] | 0;
  bool state = doc["state"] | false;
  applyMotorCommand(motor, state);
}

void connectMqtt() {
  while (!mqttClient.connected()) {
    String clientId = "wokwi-esp32-industria40-";
    clientId += String(random(0xffff), HEX);

    Serial.print("Conectando ao MQTT...");
    if (mqttClient.connect(clientId.c_str())) {
      Serial.println(" conectado");
      mqttClient.subscribe(COMMAND_TOPIC);
      Serial.print("Assinando comandos: ");
      Serial.println(COMMAND_TOPIC);
    } else {
      Serial.print(" falhou, rc=");
      Serial.print(mqttClient.state());
      Serial.println(" tentando novamente em 2s");
      delay(2000);
    }
  }
}

void updateServos() {
  if (millis() - lastServoStep < 25) return;
  lastServoStep = millis();

  for (int i = 0; i < 4; i++) {
    if (!motorState[i]) continue;

    servoAngle[i] += servoDirection[i] * 3;
    if (servoAngle[i] >= 160) {
      servoAngle[i] = 160;
      servoDirection[i] = -1;
    }
    if (servoAngle[i] <= 20) {
      servoAngle[i] = 20;
      servoDirection[i] = 1;
    }
    servos[i].write(servoAngle[i]);
  }
}

float readTemperature() {
  float value = dht.readTemperature();
  if (isnan(value)) return lastTemperature;
  lastTemperature = value;
  return value;
}

float readHumidity() {
  float value = dht.readHumidity();
  if (isnan(value)) return lastHumidity;
  lastHumidity = value;
  return value;
}

void publishTelemetry() {
  int ldrRaw = analogRead(LDR_PIN);
  int pressureRaw = analogRead(PRESSURE_PIN);

  float temperature = readTemperature();
  float humidity = readHumidity();
  float luminosity = map(ldrRaw, 0, 4095, 20, 1200);
  float pressure = map(pressureRaw, 0, 4095, 940, 1080);

  int activeMotors = 0;
  for (int i = 0; i < 4; i++) {
    if (motorState[i]) activeMotors++;
  }

  float energyConsumption = 0.8 + (activeMotors * 0.42) + (temperature * 0.015);

  StaticJsonDocument<384> doc;
  doc["deviceId"] = DEVICE_ID;
  doc["temperature"] = round(temperature * 10) / 10.0;
  doc["humidity"] = round(humidity * 10) / 10.0;
  doc["pressure"] = round(pressure);
  doc["luminosity"] = round(luminosity);
  doc["energyConsumption"] = round(energyConsumption * 100) / 100.0;
  doc["motor1"] = motorState[0];
  doc["motor2"] = motorState[1];
  doc["motor3"] = motorState[2];
  doc["motor4"] = motorState[3];

  char buffer[384];
  serializeJson(doc, buffer);
  mqttClient.publish(TELEMETRY_TOPIC, buffer);

  Serial.print("Telemetria publicada: ");
  Serial.println(buffer);
}

void setup() {
  Serial.begin(115200);
  randomSeed(analogRead(0));

  dht.begin();
  for (int i = 0; i < 4; i++) {
    servos[i].attach(SERVO_PINS[i], 500, 2400);
    servos[i].write(90);
  }

  connectWifi();
  mqttClient.setServer(MQTT_SERVER, MQTT_PORT);
  mqttClient.setCallback(onMqttMessage);
}

void loop() {
  if (WiFi.status() != WL_CONNECTED) {
    connectWifi();
  }
  if (!mqttClient.connected()) {
    connectMqtt();
  }

  mqttClient.loop();
  updateServos();

  if (millis() - lastTelemetry >= 1000) {
    lastTelemetry = millis();
    publishTelemetry();
  }
}
