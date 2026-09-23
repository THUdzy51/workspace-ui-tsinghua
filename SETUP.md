# Setup and Operation Guide

## Requirements

- Windows 10 or Windows 11
- Python 3.10 or newer
- Microsoft Edge, Google Chrome, or another default browser

No third-party Python packages are required.

## Installation

1. Download the repository as a ZIP file or clone it with Git.
2. Extract the complete folder to a stable location, such as `D:\PersonalWorkspace`.
3. Double-click `create_desktop_shortcut.bat`.
4. Approve the PowerShell prompt if Windows asks for confirmation.
5. Double-click the generated **Personal Workspace** desktop shortcut.

The launcher starts the local server in the background and opens `http://127.0.0.1:8770`.

## Local data

The application creates `user_data/` automatically:

- `schedule.json` — timed schedule entries
- `todos.json` — dated to-do items and completion state
- `hydration.json` — hydration target and daily intake

Copy the entire `user_data/` directory to preserve or migrate personal information.

## Visual assets

The `assets/` directory contains the images used by the landing page and the Windows shortcut icon. Replace these files with your own appropriately licensed assets if you customize the workspace.

## Stopping the service

Closing the browser does not terminate the local server. It stops automatically when Windows restarts. Advanced users can stop the Python process listening on port `8770`.

## Troubleshooting

### The desktop shortcut is not created

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\create_desktop_shortcut.ps1
```

### The page does not open

Confirm Python is available with `python --version`, then run:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\start_workspace.ps1
```

### Port 8770 is occupied

Stop the application using that port, or change `$port` in `start_workspace.ps1` and the default port in `server.py` to the same unused value.

### The Bing image or weather does not update

These features require internet access. Network failures do not affect calendars, tasks, schedules, or hydration data.
