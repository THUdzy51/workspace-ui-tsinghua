$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$port = 8770
$pythonCandidates = @(
  (Join-Path $root 'python.exe'),
  'python.exe',
  'py.exe'
)
$python = $pythonCandidates | Where-Object {
  if ($_ -eq 'python.exe' -or $_ -eq 'py.exe') { $true } else { Test-Path -LiteralPath $_ }
} | Select-Object -First 1
if (-not $python) { throw '未找到 Python。请安装 Python 3.10 或更高版本后重试。' }
$listener = @(Get-NetTCPConnection -LocalAddress '127.0.0.1' -LocalPort $port -State Listen -ErrorAction SilentlyContinue)
if ($listener.Count -eq 0) {
  Start-Process -FilePath $python -ArgumentList @((Join-Path $root 'server.py'), '--host', '127.0.0.1', '--port', "$port") -WorkingDirectory $root -WindowStyle Hidden
  Start-Sleep -Milliseconds 900
}
$url = "http://127.0.0.1:$port/#overview"
$edge = 'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
$chrome = 'C:\Program Files\Google\Chrome\Application\chrome.exe'
if (Test-Path -LiteralPath $edge) { Start-Process $edge -ArgumentList @('--new-window', $url) }
elseif (Test-Path -LiteralPath $chrome) { Start-Process $chrome -ArgumentList @('--new-window', $url) }
else { Start-Process 'cmd.exe' -ArgumentList @('/c','start','""',$url) }
