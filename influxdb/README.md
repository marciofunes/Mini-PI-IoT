# InfluxDB local

Instalacao nativa do InfluxDB OSS 2.x para Windows, sem Docker.

## Instalar

```powershell
cd influxdb
.\install.ps1
```

O script baixa o ZIP oficial do InfluxDB e copia `influxd.exe` para `influxdb/bin`.

## Iniciar

```powershell
cd influxdb
.\start.ps1
```

Interface web:

```text
http://localhost:8086
```

Credenciais:

```text
usuario: admin
senha: adminadmin
org: mini-pi-iot
bucket: iot
token: admin-token
```

O InfluxDB 2.x rejeita senhas com menos de 8 caracteres, por isso a senha local configurada e
`adminadmin`.

Os dados ficam em `influxdb/data` e os metadados em `influxdb/config`.
