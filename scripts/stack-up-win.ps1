# Durable TradeOps stack start for Windows.
# Breaks out of Job Objects via Win32_Process.Create + .cmd launchers with log redirect.
# Usage: powershell -NoProfile -ExecutionPolicy Bypass -File scripts\stack-up-win.ps1

$ErrorActionPreference = 'Continue'
$Root = Split-Path -Parent $PSScriptRoot
if (-not (Test-Path (Join-Path $Root 'pnpm-workspace.yaml'))) { $Root = (Get-Location).Path }
$LogDir = Join-Path $Root '.stack-logs'
New-Item -ItemType Directory -Force -Path $LogDir | Out-Null
$Node = (Get-Command node -ErrorAction Stop).Source

function Test-PortOpen([int]$Port) {
  try {
    $c = New-Object System.Net.Sockets.TcpClient
    $iar = $c.BeginConnect('127.0.0.1', $Port, $null, $null)
    $ok = $iar.AsyncWaitHandle.WaitOne(400)
    if ($ok -and $c.Connected) { $c.Close(); return $true }
    try { $c.Close() } catch {}
  } catch {}
  return $false
}

function Stop-PortHolders([int]$Port) {
  $lines = netstat -ano | Select-String ":$Port\s+.*LISTENING"
  foreach ($line in $lines) {
    $parts = ($line.ToString() -split '\s+') | Where-Object { $_ }
    $procId = $parts[-1]
    if ($procId -match '^\d+$' -and [int]$procId -gt 0) {
      Write-Host "  killing PID $procId on :$Port"
      Stop-Process -Id ([int]$procId) -Force -ErrorAction SilentlyContinue
    }
  }
}

function Read-DotEnv {
  $map = @{}
  $envFile = Join-Path $Root '.env'
  if (-not (Test-Path $envFile)) { return $map }
  Get-Content $envFile -Encoding UTF8 | ForEach-Object {
    $line = $_.Trim()
    if (-not $line -or $line.StartsWith('#')) { return }
    $eq = $line.IndexOf('=')
    if ($eq -le 0) { return }
    $k = $line.Substring(0, $eq).Trim()
    $v = $line.Substring($eq + 1).Trim()
    if (($v.StartsWith('"') -and $v.EndsWith('"')) -or ($v.StartsWith("'") -and $v.EndsWith("'"))) {
      $v = $v.Substring(1, $v.Length - 2)
    }
    if ($k -match '^[A-Za-z_][A-Za-z0-9_]*$') { $map[$k] = $v }
  }
  return $map
}

function Start-DetachedCmd {
  param(
    [string]$Name,
    [string]$WorkDir,
    [string]$CommandLine,
    [hashtable]$EnvMap
  )
  $out = Join-Path $LogDir "$Name.out.log"
  $err = Join-Path $LogDir "$Name.err.log"
  $launcher = Join-Path $LogDir "run-$Name.cmd"
  $envLines = @()
  if ($EnvMap) {
    foreach ($k in $EnvMap.Keys) {
      $val = [string]$EnvMap[$k]
      $val = $val -replace '%', '%%'
      $val = $val -replace '"', ''
      $envLines += "set `"$k=$val`""
    }
  }
  $body = @(
    '@echo off'
    'setlocal'
    "cd /d `"$WorkDir`""
  ) + $envLines + @(
    "echo [%date% %time%] starting $Name>> `"$out`""
    "$CommandLine >> `"$out`" 2>> `"$err`""
    "echo [%date% %time%] exited %ERRORLEVEL%>> `"$out`""
  )
  Set-Content -Path $launcher -Value ($body -join "`r`n") -Encoding ASCII

  # Win32_Process.Create starts outside the agent Job Object
  $cmdLine = "cmd.exe /c `"$launcher`""
  $res = ([wmiclass]'Win32_Process').Create($cmdLine, $WorkDir, $null)
  if ($res.ReturnValue -ne 0) {
    Write-Host "[$Name] Win32 create failed code=$($res.ReturnValue) — fallback Start-Process"
    Start-Process -FilePath 'cmd.exe' -ArgumentList @('/c', $launcher) -WorkingDirectory $WorkDir -WindowStyle Hidden
  } else {
    Write-Host "[$Name] launched PID=$($res.ProcessId) (detached)"
    $res.ProcessId | Set-Content (Join-Path $LogDir "$Name.pid") -Encoding ascii
  }
}

function Wait-Port([int]$Port, [string]$Label, [int]$MaxSec = 90) {
  for ($i = 0; $i -lt $MaxSec; $i++) {
    if (Test-PortOpen $Port) {
      Write-Host "OK $Label :$Port"
      return $true
    }
    Start-Sleep -Seconds 1
  }
  Write-Host "FAIL $Label :$Port not open after ${MaxSec}s"
  return $false
}

Write-Host "TradeOps stack-up-win root=$Root node=$Node"
$dot = Read-DotEnv
$dbPort = if ($dot['PRISMA_DEV_DB_PORT']) { [int]$dot['PRISMA_DEV_DB_PORT'] } else { 51214 }
$apiPort = if ($dot['API_PORT']) { [int]$dot['API_PORT'] } else { 4000 }
$webPort = if ($dot['WEB_PORT']) { [int]$dot['WEB_PORT'] } else { 3000 }
$databaseUrl = if ($dot['DATABASE_URL']) {
  $dot['DATABASE_URL']
} else {
  'postgresql://postgres:postgres@127.0.0.1:{0}/template1?schema=public&sslmode=disable&pgbouncer=true&connection_limit=5' -f $dbPort
}

# 1) DB
if (-not (Test-PortOpen $dbPort)) {
  Write-Host "Starting PGlite on :$dbPort"
  Stop-PortHolders $dbPort
  Start-Sleep -Seconds 1
  $dbScript = Join-Path $Root 'scripts\prisma-dev-db.mjs'
  Start-DetachedCmd -Name 'db' -WorkDir $Root -CommandLine "`"$Node`" `"$dbScript`"" -EnvMap @{
    PRISMA_DEV_DB_PORT = "$dbPort"
  }
  if (-not (Wait-Port $dbPort 'PGlite' 120)) {
    Write-Host '--- db.err ---'
    Get-Content (Join-Path $LogDir 'db.err.log') -ErrorAction SilentlyContinue | Select-Object -Last 40
    Write-Host '--- db.out ---'
    Get-Content (Join-Path $LogDir 'db.out.log') -ErrorAction SilentlyContinue | Select-Object -Last 40
    exit 1
  }
} else {
  Write-Host "OK PGlite already :$dbPort"
}

# 2) API
Write-Host "Starting API on :$apiPort"
Stop-PortHolders $apiPort
Start-Sleep -Seconds 1
$apiMain = Join-Path $Root 'apps\api\dist\main.js'
if (-not (Test-Path $apiMain)) { Write-Host "Missing $apiMain — build API first"; exit 1 }

$apiEnv = @{
  DATABASE_URL           = $databaseUrl
  AI_PROVIDER            = $(if ($dot['AI_PROVIDER']) { $dot['AI_PROVIDER'] } else { 'cohere' })
  COHERE_API_KEY         = $(if ($dot['COHERE_API_KEY']) { $dot['COHERE_API_KEY'] } else { '' })
  COHERE_CHAT_MODEL      = $(if ($dot['COHERE_CHAT_MODEL']) { $dot['COHERE_CHAT_MODEL'] } else { 'command-a-plus-05-2026' })
  COHERE_EMBED_MODEL     = $(if ($dot['COHERE_EMBED_MODEL']) { $dot['COHERE_EMBED_MODEL'] } else { 'embed-v4.0' })
  COHERE_RERANK_MODEL    = $(if ($dot['COHERE_RERANK_MODEL']) { $dot['COHERE_RERANK_MODEL'] } else { 'rerank-v3.5' })
  TAVILY_API_KEY         = $(if ($dot['TAVILY_API_KEY']) { $dot['TAVILY_API_KEY'] } else { '' })
  NODE_ENV               = $(if ($dot['NODE_ENV']) { $dot['NODE_ENV'] } else { 'development' })
  API_PORT               = "$apiPort"
  API_HOST               = $(if ($dot['API_HOST']) { $dot['API_HOST'] } else { '127.0.0.1' })
  WEB_ORIGIN             = $(if ($dot['WEB_ORIGIN']) { $dot['WEB_ORIGIN'] } else { 'http://localhost:3000' })
  TRADEOPS_ACCESS_MODE   = $(if ($dot['TRADEOPS_ACCESS_MODE']) { $dot['TRADEOPS_ACCESS_MODE'] } else { 'founder_direct' })
  AUTH_BYPASS            = $(if ($dot['AUTH_BYPASS']) { $dot['AUTH_BYPASS'] } else { 'true' })
  APP_SECRET             = $(if ($dot['APP_SECRET']) { $dot['APP_SECRET'] } else { '' })
  CREDENTIALS_MASTER_KEY = $(if ($dot['CREDENTIALS_MASTER_KEY']) { $dot['CREDENTIALS_MASTER_KEY'] } else { '' })
  REDIS_URL              = $(if ($dot['REDIS_URL']) { $dot['REDIS_URL'] } else { 'redis://localhost:6379' })
}
Start-DetachedCmd -Name 'api' -WorkDir $Root -CommandLine "`"$Node`" `"$apiMain`"" -EnvMap $apiEnv
if (-not (Wait-Port $apiPort 'API' 50)) {
  Write-Host '--- api.err ---'
  Get-Content (Join-Path $LogDir 'api.err.log') -ErrorAction SilentlyContinue | Select-Object -Last 50
  Write-Host '--- api.out ---'
  Get-Content (Join-Path $LogDir 'api.out.log') -ErrorAction SilentlyContinue | Select-Object -Last 50
  exit 1
}

$healthy = $false
for ($i = 0; $i -lt 40; $i++) {
  try {
    $r = Invoke-RestMethod -Uri "http://127.0.0.1:$apiPort/api/v1/health" -TimeoutSec 2
    $pg = @($r.dependencies | Where-Object { $_.name -eq 'postgres' })[0]
    if ($pg -and $pg.status -eq 'up') {
      Write-Host "OK API health postgres=up status=$($r.status)"
      $healthy = $true
      break
    }
  } catch {}
  Start-Sleep -Seconds 1
}
if (-not $healthy) { Write-Host 'WARN API HTTP not fully healthy yet' }

# 3) Web
Write-Host "Starting Web on :$webPort"
if (Test-PortOpen $webPort) {
  Write-Host "OK Web already :$webPort"
} else {
  Stop-PortHolders $webPort
  $nextBin = Join-Path $Root 'apps\web\node_modules\next\dist\bin\next'
  if (-not (Test-Path $nextBin)) { Write-Host "Missing next binary $nextBin"; exit 1 }
  $webEnv = @{
    API_PUBLIC_URL             = $(if ($dot['API_PUBLIC_URL']) { $dot['API_PUBLIC_URL'] } else { 'http://127.0.0.1:4000' })
    NEXT_PUBLIC_API_PUBLIC_URL = $(if ($dot['NEXT_PUBLIC_API_PUBLIC_URL']) { $dot['NEXT_PUBLIC_API_PUBLIC_URL'] } else { 'http://127.0.0.1:4000' })
    PORT                       = "$webPort"
    HOSTNAME                   = '127.0.0.1'
  }
  # Prefer production start; fall back to dev
  Start-DetachedCmd -Name 'web' -WorkDir (Join-Path $Root 'apps\web') -CommandLine "`"$Node`" `"$nextBin`" start -p $webPort -H 127.0.0.1" -EnvMap $webEnv
  if (-not (Wait-Port $webPort 'Web' 45)) {
    Write-Host '--- web logs (start failed, trying next dev) ---'
    Get-Content (Join-Path $LogDir 'web.err.log') -ErrorAction SilentlyContinue | Select-Object -Last 30
    Stop-PortHolders $webPort
    Start-Sleep -Seconds 1
    Start-DetachedCmd -Name 'web' -WorkDir (Join-Path $Root 'apps\web') -CommandLine "`"$Node`" `"$nextBin`" dev -p $webPort -H 127.0.0.1" -EnvMap $webEnv
    if (-not (Wait-Port $webPort 'Web(dev)' 90)) {
      Get-Content (Join-Path $LogDir 'web.err.log') -ErrorAction SilentlyContinue | Select-Object -Last 50
      Get-Content (Join-Path $LogDir 'web.out.log') -ErrorAction SilentlyContinue | Select-Object -Last 50
      exit 1
    }
  }
}

# Final probe
Write-Host ''
Write-Host '=== Final probes ==='
foreach ($pair in @(
    @{ n = 'DB'; p = $dbPort },
    @{ n = 'API'; p = $apiPort },
    @{ n = 'Web'; p = $webPort }
  )) {
  $up = Test-PortOpen $pair.p
  Write-Host ("  {0} :{1} {2}" -f $pair.n, $pair.p, $(if ($up) { 'UP' } else { 'DOWN' }))
}
try {
  $h = Invoke-WebRequest -Uri "http://127.0.0.1:$webPort/" -UseBasicParsing -TimeoutSec 8
  Write-Host "  Web HTTP $($h.StatusCode)"
} catch {
  Write-Host "  Web HTTP fail: $($_.Exception.Message)"
}
try {
  $a = Invoke-RestMethod -Uri "http://127.0.0.1:$apiPort/api/v1/health" -TimeoutSec 5
  Write-Host "  API status=$($a.status)"
} catch {
  Write-Host "  API HTTP fail"
}

Write-Host ''
Write-Host 'Open: http://127.0.0.1:3000  or  http://localhost:3000'
Write-Host "Logs: $LogDir"
exit 0
