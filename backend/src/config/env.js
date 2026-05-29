import dotenv from "dotenv";

dotenv.config();

export const env = {
  port: Number(process.env.PORT || 3001),
  influxUrl: process.env.INFLUX_URL || "http://localhost:8086",
  influxToken: process.env.INFLUX_TOKEN || "admin-token",
  influxOrg: process.env.INFLUX_ORG || "mini-pi-iot",
  influxBucket: process.env.INFLUX_BUCKET || "iot",
  mqttBrokerUrl: process.env.MQTT_BROKER_URL || "mqtt://localhost:1883",
  mqttTelemetryTopic: process.env.MQTT_TELEMETRY_TOPIC || "industria40/sensores",
  mqttCommandTopic: process.env.MQTT_COMMAND_TOPIC || "industria40/atuadores",
  frontendOrigin: process.env.FRONTEND_ORIGIN || "http://localhost:5173"
};
