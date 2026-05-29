import mqtt from "mqtt";
import { env } from "../config/env.js";
import { saveReading } from "./readings.js";

let client;

export function startMqtt(io) {
  client = mqtt.connect(env.mqttBrokerUrl, {
    clientId: `iot-backend-${Math.random().toString(16).slice(2)}`,
    clean: true,
    protocolVersion: 4,
    reconnectPeriod: 3000
  });

  client.on("connect", () => {
    console.log(`[mqtt] conectado em ${env.mqttBrokerUrl}`);
    client.subscribe(env.mqttTelemetryTopic, (error) => {
      if (error) {
        console.error("[mqtt] falha ao assinar topico:", error.message);
        return;
      }
      console.log(`[mqtt] assinando telemetria: ${env.mqttTelemetryTopic}`);
    });
  });

  client.on("message", async (topic, message) => {
    if (topic !== env.mqttTelemetryTopic) return;

    try {
      const payload = JSON.parse(message.toString());
      const result = await saveReading(payload, "mqtt");
      io.emit("reading:new", result.reading);
    } catch (error) {
      console.error("[mqtt] payload invalido:", error.message);
    }
  });

  client.on("error", (error) => {
    console.error("[mqtt] erro:", error.message);
  });
}

export function publishMotorCommand(motor, state) {
  if (!client || !client.connected) {
    throw new Error("Cliente MQTT ainda nao conectado");
  }

  const motorNumber = Number(motor);
  if (!Number.isInteger(motorNumber) || motorNumber < 1 || motorNumber > 4) {
    throw new Error("Motor deve estar entre 1 e 4");
  }

  const payload = JSON.stringify({
    motor: motorNumber,
    state: Boolean(state),
    timestamp: new Date().toISOString()
  });

  client.publish(env.mqttCommandTopic, payload, { qos: 0, retain: false });
  return JSON.parse(payload);
}
