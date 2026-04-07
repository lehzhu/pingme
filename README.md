# Ping Me! 

Teams-style completion notifications for Claude Code on macOS, with a custom popup icon and Teams sound.

Please try this out at your own risk. No testing has been performed on its stability. 

## What It Does

- Adds `Stop` and `SubagentStop` hooks to Claude Code
- Plays a Microsoft Teams notification sound when Claude finishes
- On macOS, can show a custom popup with the Teams app icon
- Keeps everything reversible with `custom`, `native`, `off`, and `--uninstall`

## Requirements

- Node.js 18+
- Claude Code
- macOS for the custom popup mode

## Install

Quick install:

```bash
npx github:lehzhu/claudesound --mode custom
```

Or clone the repo and run locally:

```bash
git clone https://github.com/lehzhu/claudesound.git
cd claudesound
node bin/claudesound.js --mode custom
```

The installer will:

- prompt for a Teams sound
- copy the Teams icon if it can find `Microsoft Teams.app`
- update `~/.claude/settings.json`
- send a test popup and sound

Restart Claude Code after installation.

## Modes

```bash
node bin/claudesound.js --mode custom
node bin/claudesound.js --mode native
node bin/claudesound.js --mode off
```

- `custom`: macOS custom popup plus sound
- `native`: native notification plus sound
- `off`: sound only

## Uninstall

```bash
node bin/claudesound.js --uninstall
```

This removes only the hooks and assets managed by `claudesound`.

## Test

```bash
npm test
```

## Notes

- The current custom popup path is macOS-focused.
- The CLI stores sound and icon assets under `~/.claude/`.
- If Microsoft Teams is not installed, the popup falls back to the Claude app icon when available.


This product is provided ​“AS IS”. Other than as provided in this agreement, this developer makes no other warranties, express or implied, and hereby disclaims all implied warranties, including any warranty of merchantability and warranty of fitness for a particular purpose.


