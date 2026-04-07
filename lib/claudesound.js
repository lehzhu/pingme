const MANAGED_MARKER = "CLAUDESOUND_MANAGED=1";

const TEAMS_MESSAGES = [
  "hey, you there? I finished that thing you asked me to do - Claude",
  "done! take a look when you get a sec - Claude",
  "heads up - I need you to check something - Claude",
  "just wrapped up, lmk what you think - Claude",
  "ping! got something for you - Claude",
  "yo, come take a look at this - Claude",
];

function escapeForDoubleQuotes(value) {
  return value.replace(/(["\\$`])/g, "\\$1");
}

function resolveNotificationMode({ platform, cliMode }) {
  if (cliMode === "custom" || cliMode === "native" || cliMode === "off") {
    return cliMode;
  }

  if (platform === "darwin") {
    return "custom";
  }

  return "native";
}

function buildMessageSelectionSnippet() {
  const messages = TEAMS_MESSAGES.map((message) => `"${escapeForDoubleQuotes(message)}"`).join(" ");
  return `messages=(${messages}); msg=\${messages[$RANDOM % \${#messages[@]}]}`;
}

function buildDarwinCustomNotifyCommand(iconFile) {
  const safeIcon = escapeForDoubleQuotes(iconFile);
  return `${MANAGED_MARKER} bash -lc '${buildMessageSelectionSnippet()}; osascript -e "display dialog \\"$msg\\" with title \\"Microsoft Teams\\" with icon POSIX file \\"${safeIcon}\\" giving up after 6"'`;
}

function buildDarwinNativeNotifyCommand() {
  return `${MANAGED_MARKER} bash -lc '${buildMessageSelectionSnippet()}; osascript -e "display notification \\"$msg\\" with title \\"Claude\\" subtitle \\"Microsoft Teams\\""'`;
}

function buildLinuxNotifyCommand(iconFile) {
  const safeIcon = escapeForDoubleQuotes(iconFile);
  return `${MANAGED_MARKER} bash -lc '${buildMessageSelectionSnippet()}; notify-send "Microsoft Teams - Claude" "$msg" -i "${safeIcon}"'`;
}

function buildWindowsNotifyCommand() {
  return `${MANAGED_MARKER} powershell.exe -Command "[System.Reflection.Assembly]::LoadWithPartialName('System.Windows.Forms'); [System.Windows.Forms.MessageBox]::Show('Claude is done.', 'Microsoft Teams')"`;
}

function buildVisualHook({ platform, notificationMode, iconFile }) {
  if (notificationMode === "off") {
    return null;
  }

  let command;

  if (platform === "darwin") {
    command =
      notificationMode === "custom"
        ? buildDarwinCustomNotifyCommand(iconFile)
        : buildDarwinNativeNotifyCommand();
  } else if (platform === "linux") {
    command = buildLinuxNotifyCommand(iconFile);
  } else {
    command = buildWindowsNotifyCommand();
  }

  return {
    type: "command",
    command,
    async: true,
  };
}

function buildSoundHook({ platform, soundFile }) {
  let command;

  if (platform === "darwin") {
    command = `${MANAGED_MARKER} afplay "${soundFile}"`;
  } else if (platform === "linux") {
    command = `${MANAGED_MARKER} bash -lc 'paplay "${soundFile}" 2>/dev/null || aplay "${soundFile}" 2>/dev/null || true'`;
  } else {
    command = `${MANAGED_MARKER} powershell.exe -Command "(New-Object Media.SoundPlayer '${soundFile}').PlaySync()"`;
  }

  return {
    type: "command",
    command,
    async: true,
  };
}

function buildManagedHookEvents({ platform, notificationMode, soundFile, iconFile }) {
  const hooks = [];
  const visualHook = buildVisualHook({ platform, notificationMode, iconFile });

  if (visualHook) {
    hooks.push(visualHook);
  }

  hooks.push(buildSoundHook({ platform, soundFile }));

  return {
    Stop: [{ hooks }],
    SubagentStop: [{ hooks }],
  };
}

function cloneSettings(settings) {
  return JSON.parse(JSON.stringify(settings ?? {}));
}

function isManagedCommand(command = "") {
  return command.includes(MANAGED_MARKER) || command.includes("teams-notification.mp3");
}

function isManagedEntry(entry) {
  return entry?.hooks?.some((hook) => isManagedCommand(hook.command));
}

function removeManagedEntries(entries = []) {
  return entries.filter((entry) => !isManagedEntry(entry));
}

function applyManagedHooks(settings, options) {
  const updated = cloneSettings(settings);
  updated.hooks = updated.hooks || {};

  for (const eventName of ["Notification", "Stop", "SubagentStop"]) {
    if (!updated.hooks[eventName]) {
      continue;
    }

    const remaining = removeManagedEntries(updated.hooks[eventName]);
    if (remaining.length > 0) {
      updated.hooks[eventName] = remaining;
    } else {
      delete updated.hooks[eventName];
    }
  }

  const managedEvents = buildManagedHookEvents(options);
  for (const [eventName, entries] of Object.entries(managedEvents)) {
    updated.hooks[eventName] = [...(updated.hooks[eventName] || []), ...entries];
  }

  return updated;
}

function removeManagedHooks(settings) {
  const updated = cloneSettings(settings);
  if (!updated.hooks) {
    return updated;
  }

  for (const eventName of ["Notification", "Stop", "SubagentStop"]) {
    if (!updated.hooks[eventName]) {
      continue;
    }

    const remaining = removeManagedEntries(updated.hooks[eventName]);
    if (remaining.length > 0) {
      updated.hooks[eventName] = remaining;
    } else {
      delete updated.hooks[eventName];
    }
  }

  if (Object.keys(updated.hooks).length === 0) {
    delete updated.hooks;
  }

  return updated;
}

module.exports = {
  MANAGED_MARKER,
  applyManagedHooks,
  buildManagedHookEvents,
  removeManagedHooks,
  resolveNotificationMode,
};
