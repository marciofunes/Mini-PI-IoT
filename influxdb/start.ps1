$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$bin = Join-Path $root "bin"
$data = Join-Path $root "data"
$config = Join-Path $root "config"
$logs = Join-Path $root "logs"
$influxd = Join-Path $bin "influxd.exe"

$url = "http://localhost:8086"
$username = "admin"
$password = "adminadmin"
$token = "admin-token"
$org = "mini-pi-iot"
$bucket = "iot"

if (!(Test-Path $influxd)) {
  throw "InfluxDB nao esta instalado. Rode primeiro: cd influxdb; .\install.ps1"
}

New-Item -ItemType Directory -Force -Path $data, $config, $logs | Out-Null

$running = Get-NetTCPConnection -LocalPort 8086 -ErrorAction SilentlyContinue
if (!$running) {
  $arguments = @(
    "--bolt-path", "`"$config\influxd.bolt`"",
    "--engine-path", "`"$data\engine`"",
    "--sqlite-path", "`"$config\influxd.sqlite`"",
    "--reporting-disabled"
  )

  $stdout = Join-Path $logs "influxd.log"
  $stderr = Join-Path $logs "influxd.err.log"
  $command = "set INFLUXD_STRONG_PASSWORDS=false&& `"$influxd`" $($arguments -join ' ') > `"$stdout`" 2> `"$stderr`""

  $processInfo = [System.Diagnostics.ProcessStartInfo]::new()
  $processInfo.FileName = "$env:SystemRoot\System32\cmd.exe"
  $processInfo.Arguments = "/c $command"
  $processInfo.WorkingDirectory = $root
  $processInfo.UseShellExecute = $false
  $processInfo.CreateNoWindow = $true
  [System.Diagnostics.Process]::Start($processInfo) | Out-Null
}

Write-Host "Aguardando InfluxDB em $url..."
$ready = $false
for ($i = 0; $i -lt 45; $i++) {
  try {
    $health = Invoke-RestMethod -Uri "$url/health" -Method Get -TimeoutSec 2
    if ($health.status -eq "pass") {
      $ready = $true
      break
    }
  } catch {
    Start-Sleep -Seconds 1
  }
}

if (!$ready) {
  throw "InfluxDB nao ficou pronto. Verifique influxdb\logs\influxd.err.log."
}

$setup = Invoke-RestMethod -Uri "$url/api/v2/setup" -Method Get
if ($setup.allowed) {
  $body = @{
    username = $username
    password = $password
    token = $token
    org = $org
    bucket = $bucket
  } | ConvertTo-Json

  Invoke-RestMethod -Uri "$url/api/v2/setup" -Method Post -ContentType "application/json" -Body $body | Out-Null
}

Write-Host ""
Write-Host "InfluxDB local: $url"
Write-Host "Usuario: $username"
Write-Host "Senha: $password"
Write-Host "Org: $org"
Write-Host "Bucket: $bucket"
Write-Host "Token backend: $token"
