$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$desktop = [Environment]::GetFolderPath('Desktop')
$link = Join-Path $desktop '个人工作空间.lnk'
$shell = New-Object -ComObject WScript.Shell
$shortcut = $shell.CreateShortcut($link)
$shortcut.TargetPath = 'C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe'
$shortcut.Arguments = "-NoProfile -ExecutionPolicy Bypass -File `"$(Join-Path $root 'start_workspace.ps1')`""
$shortcut.WorkingDirectory = $root
$shortcut.IconLocation = "$(Join-Path $root 'assets\doctor-dong.ico'),0"
$shortcut.Description = '启动个人工作空间'
$shortcut.Save()
Write-Output "已创建桌面快捷方式：$link"
