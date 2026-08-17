$ErrorActionPreference = "Stop"
$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$port = 4173
$url = "http://127.0.0.1:$port/"

Write-Host "RallyLens is available at $url"
Write-Host "Press Ctrl+C to stop the local server."
Start-Process $url
node (Join-Path $projectRoot "server.mjs") $port

