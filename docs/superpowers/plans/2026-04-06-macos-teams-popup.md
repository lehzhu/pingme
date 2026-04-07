# macOS Teams Popup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a reversible macOS custom completion popup with Teams sound support to the installer.

**Architecture:** Refactor the monolithic CLI into a thin entrypoint plus a small library of pure helper functions. Generate managed `Stop` and `SubagentStop` hook entries from explicit notification modes so install, reconfigure, and uninstall all use the same code paths.

**Tech Stack:** Node.js, AppleScript, Claude Code hooks, `node:test`

---

### Task 1: Extract testable hook generation

**Files:**
- Create: `lib/claudesound.js`
- Create: `test/claudesound.test.js`
- Modify: `package.json`

- [ ] **Step 1: Write the failing test**

```js
test("buildManagedHookEvents creates macOS custom popup hooks", () => {
  const events = buildManagedHookEvents({
    platform: "darwin",
    notificationMode: "custom",
  });

  assert.ok(events.Stop[0].hooks[0].command.includes("display dialog"));
  assert.equal(events.Stop[0].hooks[0].async, true);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --test-name-pattern "buildManagedHookEvents creates macOS custom popup hooks"`
Expected: FAIL because `lib/claudesound.js` does not exist yet

- [ ] **Step 3: Write minimal implementation**

Create a library module that exports a `buildManagedHookEvents()` function and returns hook entries for `Stop` and `SubagentStop`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- --test-name-pattern "buildManagedHookEvents creates macOS custom popup hooks"`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add package.json lib/claudesound.js test/claudesound.test.js
git commit -m "feat: extract hook generation helpers"
```

### Task 2: Add reversible settings mutation

**Files:**
- Modify: `lib/claudesound.js`
- Modify: `test/claudesound.test.js`

- [ ] **Step 1: Write the failing test**

```js
test("applyManagedHooks replaces old managed entries and removes legacy notification entries", () => {
  const settings = {
    hooks: {
      Notification: [{ matcher: "", hooks: [{ command: "afplay teams-notification.mp3" }] }],
      Stop: [{ hooks: [{ command: "CLAUDESOUND_MANAGED=1 old" }] }],
    },
  };

  const updated = applyManagedHooks(settings, {
    platform: "darwin",
    notificationMode: "off",
  });

  assert.equal(updated.hooks.Notification?.length ?? 0, 0);
  assert.equal(updated.hooks.Stop.length, 1);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --test-name-pattern "applyManagedHooks replaces old managed entries"`
Expected: FAIL because `applyManagedHooks` does not exist yet

- [ ] **Step 3: Write minimal implementation**

Add helpers to identify managed hooks, remove legacy `Notification` hooks, and insert current `Stop` and `SubagentStop` entries.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- --test-name-pattern "applyManagedHooks replaces old managed entries"`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add lib/claudesound.js test/claudesound.test.js
git commit -m "feat: make managed hooks replaceable"
```

### Task 3: Wire installer modes and asset setup

**Files:**
- Modify: `bin/claudesound.js`
- Modify: `lib/claudesound.js`
- Modify: `test/claudesound.test.js`

- [ ] **Step 1: Write the failing test**

```js
test("resolveNotificationMode defaults to custom on macOS", () => {
  assert.equal(resolveNotificationMode({ platform: "darwin", cliMode: undefined }), "custom");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --test-name-pattern "resolveNotificationMode defaults to custom on macOS"`
Expected: FAIL because `resolveNotificationMode` does not exist yet

- [ ] **Step 3: Write minimal implementation**

Add CLI mode parsing, Teams icon copying, Claude icon fallback, and install/uninstall flow updates that use the library helpers.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- --test-name-pattern "resolveNotificationMode defaults to custom on macOS"`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add bin/claudesound.js lib/claudesound.js test/claudesound.test.js
git commit -m "feat: add macOS popup mode selection"
```

### Task 4: Full verification

**Files:**
- Modify: `bin/claudesound.js`
- Modify: `lib/claudesound.js`
- Modify: `test/claudesound.test.js`

- [ ] **Step 1: Run the full automated test suite**

Run: `npm test`
Expected: PASS

- [ ] **Step 2: Run installer help smoke test**

Run: `node bin/claudesound.js --help`
Expected: usage output describing `--mode`

- [ ] **Step 3: Run uninstall smoke test**

Run: `node bin/claudesound.js --uninstall`
Expected: no crash, managed assets removed if present

- [ ] **Step 4: Run macOS popup smoke test**

Run: `osascript -e 'display dialog "claudesound test" with title "Microsoft Teams" with icon POSIX file "/System/Library/CoreServices/CoreTypes.bundle/Contents/Resources/ToolbarCustomizeIcon.icns" giving up after 1'`
Expected: popup displays then auto-dismisses

- [ ] **Step 5: Commit**

```bash
git add .
git commit -m "feat: add reversible macOS completion popup"
```
