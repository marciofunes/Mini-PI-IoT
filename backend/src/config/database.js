import { env } from "./env.js";

export async function connectDatabase() {
  try {
    const response = await fetch(`${env.influxUrl}/health`);
    if (!response.ok) {
      console.warn(`[influx] health check retornou HTTP ${response.status}`);
      return;
    }
    console.log(`[influx] conectado em ${env.influxUrl}`);
  } catch (error) {
    console.warn(`[influx] indisponivel em ${env.influxUrl}: ${error.message}`);
  }
}
