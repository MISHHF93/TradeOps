#Requires -RunAsAdministrator
<#
  Registers and starts the PostgreSQL 16 Windows service after an EnterpriseDB install
  that left files on disk but no service (common under partial installs).

  Run in elevated PowerShell:
    Set-ExecutionPolicy -Scope Process Bypass
    .\scripts\register-postgres-service.ps1
#>

$ErrorActionPreference = 'Stop'
$pgRoot = 'C:\Program Files\PostgreSQL\16'
$pgBin = Join-Path $pgRoot 'bin'
$pgData = Join-Path $pgRoot 'data'
$serviceName = 'postgresql-x64-16'
$pgCtl = Join-Path $pgBin 'pg_ctl.exe'

if (-not (Test-Path $pgCtl)) {
  throw "PostgreSQL not found at $pgCtl"
}

Write-Host "Registering service $serviceName ..."
& $pgCtl register -N $serviceName -D $pgData -U "NT AUTHORITY\NetworkService"
if ($LASTEXITCODE -ne 0) {
  Write-Host "pg_ctl register failed (exit $LASTEXITCODE). Trying sc create..."
  $binPath = "`"$pgCtl`" runservice -N `"$serviceName`" -D `"$pgData`" -w"
  sc.exe create $serviceName binPath= $binPath start= auto obj= "NT AUTHORITY\NetworkService"
}

Start-Service $serviceName
Start-Sleep -Seconds 2
Get-Service $serviceName | Format-Table Name, Status

Write-Host ""
Write-Host "If the service is Running, create the app role/db (replace SUPERUSER_PASSWORD):"
Write-Host "  `$env:PGPASSWORD='YOUR_POSTGRES_PASSWORD'"
Write-Host "  & '$pgBin\psql.exe' -U postgres -c `"CREATE USER tradeops WITH PASSWORD 'tradeops' CREATEDB;`""
Write-Host "  & '$pgBin\psql.exe' -U postgres -c `"CREATE DATABASE tradeops OWNER tradeops;`""
Write-Host ""
Write-Host "Then from the repo:"
Write-Host "  cd C:\Users\borah\TradeOps"
Write-Host "  pnpm run setup:db"
Write-Host "  npm start"
