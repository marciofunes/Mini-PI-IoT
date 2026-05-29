# Broker MQTT local

Broker MQTT simples em Python para a demo local do Wokwi, sem dependencias externas.

## Executar

```powershell
cd broker
python broker.py
```

O broker escuta em `0.0.0.0:1883`. O backend deve conectar em `mqtt://localhost:1883`, e o ESP32
simulado no Wokwi deve usar `host.wokwi.internal` para acessar o broker da maquina local.

Este broker implementa o fluxo usado pelo projeto: CONNECT, SUBSCRIBE, PUBLISH QoS 0, PING e
DISCONNECT.
