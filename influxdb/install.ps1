$ErrorActionPreference = "Stop"

$version = "2.8.0"
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$downloads = Join-Path $root "downloads"
$extract = Join-Path $root "extract"
$bin = Join-Path $root "bin"
$zip = Join-Path $downloads "influxdb2-$version-windows_amd64.zip"
$url = "https://dl.influxdata.com/influxdb/releases/influxdb2-$version-windows_amd64.zip"

New-Item -ItemType Directory -Force -Path $downloads, $extract, $bin | Out-Null

if (!(Test-Path $zip)) {
  Write-Host "Baixando InfluxDB $version..."
  Invoke-WebRequest -Uri $url -OutFile $zip
}

Write-Host "Extraindo InfluxDB..."
Remove-Item -Recurse -Force $extract -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Force -Path $extract | Out-Null
Expand-Archive -Path $zip -DestinationPath $extract -Force

$influxd = Get-ChildItem -Path $extract -Recurse -Filter "influxd.exe" | Select-Object -First 1
if (!$influxd) {
  throw "Nao encontrei influxd.exe dentro do ZIP baixado."
}

Copy-Item -Force $influxd.FullName (Join-Path $bin "influxd.exe")

Write-Host ""
Write-Host "InfluxDB instalado em: $bin"
Write-Host "Para iniciar: .\start.ps1"
