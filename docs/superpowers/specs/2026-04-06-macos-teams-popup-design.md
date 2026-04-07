# macOS Teams Popup Design

## Goal

Add a macOS completion notification path that feels like Microsoft Teams, uses the Teams sound, shows a custom icon reliably, and can be disabled or uninstalled cleanly.

## Constraints

- The existing project is a single CLI that edits `~/.claude/settings.json`.
- macOS Notification Center does not expose a reliable custom icon path through the current `osascript display notification` approach.
- The feature must be easy to reverse after the joke gets old.

## Approach

Use Claude Code `Stop` and `SubagentStop` hooks for completion events instead of `Notification` hooks. On macOS, the visual notification becomes a transient custom popup implemented with AppleScript `display dialog ... giving up after`, because dialogs support a custom icon file path while Notification Center banners do not.

The installer will continue to manage the Teams sound separately. Visual notification behavior becomes configurable:

- `custom`: show the macOS popup with a Teams-style icon
- `native`: use the existing native notification command
- `off`: disable the visual notification and keep sound only

## Asset Strategy

When Microsoft Teams is installed, copy its app icon from `/Applications/Microsoft Teams.app/Contents/Resources/AppIcon.icns` into `~/.claude/assets/teams-icon.icns`. If Teams is not installed, fall back to the existing Claude icon extraction path so the popup still works.

## Reversibility

All managed hooks will be tagged with a stable marker so the installer can replace or remove only its own entries. Re-running the installer with a different mode updates the hook config in place. `--uninstall` removes the managed hooks and installed assets.

## File Structure

- `bin/claudesound.js`: CLI entrypoint, argument parsing, installation flow
- `lib/claudesound.js`: pure helper logic for hook generation, settings mutation, and asset decisions
- `test/claudesound.test.js`: regression coverage for hook generation and cleanup behavior

## Verification

- Unit tests cover hook mode generation and managed hook cleanup.
- Manual verification on macOS confirms:
  - `display dialog` popup renders with a custom icon
  - the Teams sound still plays
  - `--mode native`, `--mode off`, and `--uninstall` behave as expected
