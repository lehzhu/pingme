const test = require("node:test");
const assert = require("node:assert/strict");

const {
  applyManagedHooks,
  buildManagedHookEvents,
  removeManagedHooks,
  resolveNotificationMode,
} = require("../lib/claudesound");

test("buildManagedHookEvents creates macOS custom popup hooks", () => {
  const events = buildManagedHookEvents({
    platform: "darwin",
    notificationMode: "custom",
    soundFile: "/tmp/teams-notification.mp3",
    iconFile: "/tmp/teams-icon.icns",
  });

  assert.ok(events.Stop);
  assert.ok(events.SubagentStop);
  assert.equal(events.Stop[0].hooks[0].async, true);
  assert.match(events.Stop[0].hooks[0].command, /display dialog/);
  assert.match(events.Stop[0].hooks[0].command, /teams-icon\.icns/);
  assert.match(events.Stop[0].hooks[0].command, /- Claude/);
});

test("applyManagedHooks replaces old managed entries and removes legacy notification entries", () => {
  const settings = {
    hooks: {
      Notification: [
        {
          matcher: "",
          hooks: [{ type: "command", command: "afplay /tmp/teams-notification.mp3" }],
        },
      ],
      Stop: [
        {
          hooks: [{ type: "command", command: "CLAUDESOUND_MANAGED=1 old-stop" }],
        },
      ],
      SubagentStop: [
        {
          hooks: [{ type: "command", command: "CLAUDESOUND_MANAGED=1 old-subagent" }],
        },
      ],
    },
  };

  const updated = applyManagedHooks(settings, {
    platform: "darwin",
    notificationMode: "off",
    soundFile: "/tmp/teams-notification.mp3",
    iconFile: "/tmp/teams-icon.icns",
  });

  assert.equal(updated.hooks.Notification?.length ?? 0, 0);
  assert.equal(updated.hooks.Stop.length, 1);
  assert.equal(updated.hooks.SubagentStop.length, 1);
  assert.doesNotMatch(updated.hooks.Stop[0].hooks[0].command, /old-stop/);
});

test("resolveNotificationMode defaults to custom on macOS", () => {
  assert.equal(
    resolveNotificationMode({ platform: "darwin", cliMode: undefined }),
    "custom"
  );
  assert.equal(
    resolveNotificationMode({ platform: "linux", cliMode: undefined }),
    "native"
  );
  assert.equal(
    resolveNotificationMode({ platform: "darwin", cliMode: "off" }),
    "off"
  );
});

test("removeManagedHooks keeps unrelated hook entries", () => {
  const settings = {
    hooks: {
      Stop: [
        {
          hooks: [{ type: "command", command: "CLAUDESOUND_MANAGED=1 afplay /tmp/teams.mp3" }],
        },
        {
          hooks: [{ type: "command", command: "echo keep-me" }],
        },
      ],
      Notification: [
        {
          hooks: [{ type: "command", command: "afplay /tmp/teams-notification.mp3" }],
        },
      ],
    },
  };

  const cleaned = removeManagedHooks(settings);

  assert.deepEqual(cleaned.hooks.Stop, [
    {
      hooks: [{ type: "command", command: "echo keep-me" }],
    },
  ]);
  assert.equal(cleaned.hooks.Notification, undefined);
});

test("removeManagedHooks preserves unrelated top-level settings", () => {
  const settings = {
    theme: "dark",
    hooks: {
      Stop: [
        {
          hooks: [{ type: "command", command: "CLAUDESOUND_MANAGED=1 afplay /tmp/teams.mp3" }],
        },
      ],
    },
  };

  const cleaned = removeManagedHooks(settings);

  assert.equal(cleaned.theme, "dark");
  assert.equal(cleaned.hooks, undefined);
});
