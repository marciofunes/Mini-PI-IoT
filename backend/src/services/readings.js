import { env } from "../config/env.js";

const requiredNumberFields = [
  "temperature",
  "humidity",
  "pressure",
  "luminosity",
  "energyConsumption"
];

const motorFields = ["motor1", "motor2", "motor3", "motor4"];

function escapeTag(value) {
  return String(value).replaceAll("\\", "\\\\").replaceAll(",", "\\,").replaceAll(" ", "\\ ").replaceAll("=", "\\=");
}

function fieldValue(value) {
  if (typeof value === "boolean") return value ? "true" : "false";
  if (Number.isFinite(Number(value))) return String(Number(value));
  return `"${String(value).replaceAll("\\", "\\\\").replaceAll('"', '\\"')}"`;
}

function toLineProtocol(reading) {
  const tags = [
    `deviceId=${escapeTag(reading.deviceId)}`,
    `source=${escapeTag(reading.source)}`
  ].join(",");

  const fields = [...requiredNumberFields, ...motorFields]
    .map((field) => `${field}=${fieldValue(reading[field])}`)
    .join(",");

  return `iot_readings,${tags} ${fields} ${reading.timestamp.getTime()}`;
}

function parseCsvLine(line) {
  const values = [];
  let current = "";
  let quoted = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const next = line[i + 1];

    if (char === '"' && quoted && next === '"') {
      current += '"';
      i++;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      values.push(current);
      current = "";
    } else {
      current += char;
    }
  }

  values.push(current);
  return values;
}

function parseInfluxCsv(csv) {
  const lines = csv.split(/\r?\n/).filter((line) => line && !line.startsWith("#"));
  if (lines.length < 2) return [];

  const header = parseCsvLine(lines[0]);
  return lines.slice(1).map((line) => {
    const values = parseCsvLine(line);
    const row = Object.fromEntries(header.map((column, index) => [column, values[index]]));
    const reading = {
      deviceId: row.deviceId || "esp32-industria-01",
      source: row.source || "mqtt",
      timestamp: row._time || new Date().toISOString()
    };

    for (const field of requiredNumberFields) {
      reading[field] = Number(row[field] || 0);
    }

    for (const field of motorFields) {
      reading[field] = row[field] === "true";
    }

    return reading;
  });
}

export function normalizeReading(payload, source = "mqtt") {
  const reading = {
    deviceId: String(payload.deviceId || "esp32-industria-01"),
    source,
    timestamp: payload.timestamp ? new Date(payload.timestamp) : new Date()
  };

  for (const field of requiredNumberFields) {
    const value = Number(payload[field]);
    if (!Number.isFinite(value)) {
      throw new Error(`Campo numerico invalido: ${field}`);
    }
    reading[field] = value;
  }

  for (const field of motorFields) {
    if (typeof payload[field] === "boolean") {
      reading[field] = payload[field];
    } else if (payload[field] === 1 || payload[field] === "1" || payload[field] === "true") {
      reading[field] = true;
    } else if (payload[field] === 0 || payload[field] === "0" || payload[field] === "false") {
      reading[field] = false;
    } else {
      throw new Error(`Campo digital invalido: ${field}`);
    }
  }

  if (Number.isNaN(reading.timestamp.getTime())) {
    reading.timestamp = new Date();
  }

  return reading;
}

export async function saveReading(payload, source = "mqtt") {
  const reading = normalizeReading(payload, source);
  const params = new URLSearchParams({
    org: env.influxOrg,
    bucket: env.influxBucket,
    precision: "ms"
  });

  const response = await fetch(`${env.influxUrl}/api/v2/write?${params}`, {
    method: "POST",
    headers: {
      Authorization: `Token ${env.influxToken}`,
      "Content-Type": "text/plain; charset=utf-8"
    },
    body: toLineProtocol(reading)
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`Falha ao gravar no InfluxDB: HTTP ${response.status} ${details}`);
  }

  return { persisted: true, reading };
}

async function queryReadings(limit = 100) {
  const safeLimit = Math.min(Number(limit) || 100, 500);
  const query = `
from(bucket: "${env.influxBucket}")
  |> range(start: -30d)
  |> filter(fn: (r) => r._measurement == "iot_readings")
  |> pivot(rowKey:["_time"], columnKey: ["_field"], valueColumn: "_value")
  |> sort(columns: ["_time"], desc: true)
  |> limit(n: ${safeLimit})
`;

  const response = await fetch(`${env.influxUrl}/api/v2/query?org=${encodeURIComponent(env.influxOrg)}`, {
    method: "POST",
    headers: {
      Authorization: `Token ${env.influxToken}`,
      Accept: "application/csv",
      "Content-Type": "application/vnd.flux"
    },
    body: query
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`Falha ao consultar InfluxDB: HTTP ${response.status} ${details}`);
  }

  return parseInfluxCsv(await response.text());
}

export async function listReadings(limit = 100) {
  return queryReadings(limit);
}

export async function latestReading() {
  const [reading] = await queryReadings(1);
  return reading || null;
}
