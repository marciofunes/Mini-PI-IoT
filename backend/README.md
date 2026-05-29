# Backend IoT Industria 4.0

Backend Node.js que recebe telemetria MQTT do ESP32/Wokwi, persiste no InfluxDB local e publica os dados em tempo real para o frontend via Socket.IO.

Antes de iniciar o backend, suba o InfluxDB local:

```bash
cd ../influxdb
./start.ps1
```

Depois suba o broker local:

```bash
cd ../broker
python broker.py
```

## Configuracao

```bash
cp .env.example .env
npm install
npm run dev
```

O arquivo `.env` ja vem configurado para o InfluxDB local:

```env
INFLUX_URL=http://localhost:8086
INFLUX_TOKEN=admin-token
INFLUX_ORG=mini-pi-iot
INFLUX_BUCKET=iot
```

## MQTT

Broker padrao:

```text
mqtt://localhost:1883
```

Telemetria recebida:

```text
industria40/sensores
```

Comandos de atuadores enviados:

```text
industria40/atuadores
```

## Endpoints

```text
GET  /health
GET  /api/readings/latest
GET  /api/readings?limit=100
POST /api/readings
POST /api/motors/:motor/command
```

Comando de motor:

```json
{
  "state": true
}
```
