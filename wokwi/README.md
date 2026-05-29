# Simulacao Wokwi

Arquivos:

```text
sketch.ino
diagram.json
```

Ao pressionar Play no Wokwi local, o ESP32 conecta no Wi-Fi simulado `Wokwi-GUEST`, acessa o broker
local em `host.wokwi.internal:1883`, publica telemetria a cada 1 segundo no topico MQTT
`industria40/sensores` e escuta comandos em `industria40/atuadores`.

Bibliotecas usadas no sketch:

```text
PubSubClient
ArduinoJson
DHT sensor library
ESP32Servo
```

O arquivo `libraries.txt` ja declara essas dependencias para o Wokwi. Nao copie arquivos como
`PubSubClient.cpp` ou `PubSubClient.h` para dentro do projeto, porque o Wokwi tambem compila a
biblioteca instalada e isso gera erro de `multiple definition`.

Se aparecer erro apontando para `/sketch/PubSubClient.cpp.o` e `/libraries/PubSubClient`, apague no
Wokwi as abas/arquivos `PubSubClient.cpp` e `PubSubClient.h`, mantendo somente:

```text
sketch.ino
diagram.json
libraries.txt
```

Payload de comando esperado:

```json
{
  "motor": 1,
  "state": true
}
```
