# Tsinghua Personal Workspace UI

A lightweight, portable personal workspace for Windows. It provides a calendar, dated to-do lists, scheduled reminders, hydration tracking, Shenzhen weather, and a Bing daily-image panel in a quiet research-oriented interface.

This public archive is independent from the original literature knowledge base. It does not include research documents, Web of Science workflows, Zotero data, credentials, personal schedules, or local runtime records.

## Features

- Monthly calendar with separate schedule and to-do indicators
- Date-specific to-do lists with completion tracking
- Timed schedule reminders
- Daily hydration tracking with configurable targets
- Shenzhen weather summary
- Bing daily image with a local fallback background
- Local JSON persistence under `user_data/`
- Windows desktop shortcut and custom icon
- Dependency-free Python HTTP server

## Quick start

1. Download or clone this repository.
2. Install Python 3.10 or newer and add it to `PATH`.
3. Run `create_desktop_shortcut.bat`.
4. Double-click **Personal Workspace** on the desktop.

The workspace opens at `http://127.0.0.1:8770`.

See [SETUP.md](SETUP.md) for detailed installation, migration, and troubleshooting instructions.

## Data and privacy

Schedules, tasks, and hydration records remain on the local computer in `user_data/`. This directory is ignored by Git and is not included in the repository. Back it up when migrating to another computer.

The application requests Bing image metadata and current weather information when those panels load. If the network is unavailable, the interface remains usable and falls back to its bundled background.

## Repository scope

This repository contains only the portable workspace UI and its required visual assets. It excludes the private AI Zotero knowledge base, research ideas, Web of Science tools, API keys, logs, and user data.

## License

Source code is released under the MIT License. University names, logos, photographs, and other visual assets may be subject to their respective owners' trademark or copyright policies.
