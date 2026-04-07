#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const https = require("https");
const readline = require("readline");
const { execSync } = require("child_process");
const os = require("os");

const {
  applyManagedHooks,
  buildManagedHookEvents,
  removeManagedHooks,
  resolveNotificationMode,
} = require("../lib/claudesound");

const CLAUDE_DIR = path.join(os.homedir(), ".claude");
const SOUNDS_DIR = path.join(CLAUDE_DIR, "sounds");
const ASSETS_DIR = path.join(CLAUDE_DIR, "assets");
const SOUND_FILE = path.join(SOUNDS_DIR, "teams-notification.mp3");
const TEAMS_ICON_FILE = path.join(ASSETS_DIR, "teams-icon.icns");
const LEGACY_ICON_FILE = path.join(ASSETS_DIR, "claude-icon.png");
const SETTINGS_FILE = path.join(CLAUDE_DIR, "settings.json");

const TEAMS_APP_ICON = "/Applications/Microsoft Teams.app/Contents/Resources/AppIcon.icns";
const CLAUDE_APP_ICON = "/Applications/Claude.app/Contents/Resources/electron.icns";

const SOUND_BASE_URL =
  "https://raw.githubusercontent.com/5a9awneh/ms-teams-sounds/main/Notifications";

const SOUNDS = [
  { name: "Default", file: "Default.mp3", description: "Classic Teams ding" },
  { name: "Flick", file: "Flick.mp3", description: "Quick flick" },
  { name: "Nudge", file: "Nudge.mp3", description: "Gentle nudge" },
  { name: "Ping", file: "Ping.mp3", description: "Sharp ping" },
  { name: "Pluck", file: "Pluck.mp3", description: "Soft pluck" },
  { name: "Tap", file: "Tap.mp3", description: "Light tap" },
];

const platform = os.platform();

function download(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    const request = (reqUrl) => {
      https
        .get(reqUrl, (res) => {
          if (
            res.statusCode >= 300 &&
            res.statusCode < 400 &&
            res.headers.location
          ) {
            file.close();
            request(res.headers.location);
            return;
          }

          if (res.statusCode !== 200) {
            file.close();
            fs.rmSync(dest, { force: true });
            reject(new Error(`Download failed: HTTP ${res.statusCode}`));
            return;
          }

          res.pipe(file);
          file.on("finish", () => file.close(resolve));
        })
        .on("error", (err) => {
          file.close();
          fs.rmSync(dest, { force: true });
          reject(err);
        });
    };

    request(url);
  });
}

function prompt(question) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

function readSettings() {
  if (!fs.existsSync(SETTINGS_FILE)) {
    return {};
  }

  try {
    return JSON.parse(fs.readFileSync(SETTINGS_FILE, "utf8"));
  } catch {
    return {};
  }
}

function writeSettings(settings) {
  fs.mkdirSync(path.dirname(SETTINGS_FILE), { recursive: true });
  fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2) + "\n");
}

function playSound(filePath) {
  try {
    if (platform === "darwin") {
      execSync(`afplay "${filePath}"`, { stdio: "ignore", shell: true });
    } else if (platform === "linux") {
      execSync(`paplay "${filePath}" 2>/dev/null || aplay "${filePath}"`, {
        stdio: "ignore",
        shell: true,
      });
    }
  } catch {}
}

function copyIconFile(source, destination) {
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.copyFileSync(source, destination);
}

function copyClaudeIcon(destination) {
  if (platform !== "darwin" || !fs.existsSync(CLAUDE_APP_ICON)) {
    return false;
  }

  try {
    copyIconFile(CLAUDE_APP_ICON, destination);
    return fs.existsSync(destination);
  } catch {
    return false;
  }
}

function setupNotificationIcon(notificationMode) {
  if (notificationMode !== "custom" || platform !== "darwin") {
    return { iconFile: TEAMS_ICON_FILE, message: "not needed" };
  }

  if (fs.existsSync(TEAMS_APP_ICON)) {
    copyIconFile(TEAMS_APP_ICON, TEAMS_ICON_FILE);
    return { iconFile: TEAMS_ICON_FILE, message: "done (copied Teams icon)" };
  }

  if (copyClaudeIcon(TEAMS_ICON_FILE)) {
    return { iconFile: TEAMS_ICON_FILE, message: "done (using Claude icon fallback)" };
  }

  return { iconFile: TEAMS_ICON_FILE, message: "skipped (no Teams or Claude icon found)" };
}

function previewHooks(notificationMode) {
  const events = buildManagedHookEvents({
    platform,
    notificationMode,
    soundFile: SOUND_FILE,
    iconFile: TEAMS_ICON_FILE,
  });

  const hooks = events.Stop[0].hooks;
  for (const hook of hooks) {
    try {
      execSync(hook.command, { stdio: "ignore", shell: true });
    } catch {}
  }
}

async function pickSound() {
  console.log("");
  console.log("  Pick a notification sound:");
  console.log("");

  const tmpDir = path.join(os.tmpdir(), "claudesound-preview");
  fs.mkdirSync(tmpDir, { recursive: true });

  process.stdout.write("  Downloading sound previews... ");
  await Promise.all(
    SOUNDS.map((sound) =>
      download(`${SOUND_BASE_URL}/${sound.file}`, path.join(tmpDir, sound.file))
    )
  );
  console.log("done");
  console.log("");

  for (let i = 0; i < SOUNDS.length; i += 1) {
    console.log(`  ${i + 1}. ${SOUNDS[i].name} - ${SOUNDS[i].description}`);
  }
  console.log(`  ${SOUNDS.length + 1}. Play all to compare`);
  console.log("");

  while (true) {
    const answer = await prompt(
      "  Choose a sound (1-7), or press Enter for Default: "
    );

    if (answer === "") {
      return SOUNDS[0];
    }

    const num = parseInt(answer, 10);

    if (num === SOUNDS.length + 1) {
      console.log("");
      for (const sound of SOUNDS) {
        process.stdout.write(`  Playing ${sound.name}...`);
        playSound(path.join(tmpDir, sound.file));
        console.log("");
      }
      console.log("");
      continue;
    }

    if (num >= 1 && num <= SOUNDS.length) {
      const choice = SOUNDS[num - 1];
      process.stdout.write(`  Playing ${choice.name}...`);
      playSound(path.join(tmpDir, choice.file));
      console.log("");

      const confirm = await prompt("  Use this sound? (Y/n): ");
      if (confirm === "" || confirm.toLowerCase() === "y") {
        return choice;
      }
      console.log("");
      continue;
    }

    console.log("  Invalid choice, try again.");
  }
}

function parseArgs(argv) {
  const args = [...argv];
  const options = {
    help: false,
    uninstall: false,
    mode: undefined,
  };

  while (args.length > 0) {
    const arg = args.shift();

    if (arg === "--help" || arg === "-h") {
      options.help = true;
      continue;
    }

    if (arg === "--uninstall" || arg === "uninstall") {
      options.uninstall = true;
      continue;
    }

    if (arg === "--mode") {
      options.mode = args.shift();
      continue;
    }

    if (arg === "--native") {
      options.mode = "native";
      continue;
    }

    if (arg === "--off" || arg === "--sound-only") {
      options.mode = "off";
      continue;
    }

    if (arg === "--custom") {
      options.mode = "custom";
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  return options;
}

function printHelp() {
  console.log("");
  console.log("  claudesound - Teams-style notifications for Claude Code");
  console.log("");
  console.log("  Usage:");
  console.log("    npx claudesound                 Install with sound picker");
  console.log("    npx claudesound --mode custom   Use macOS custom popup");
  console.log("    npx claudesound --mode native   Use native notifications");
  console.log("    npx claudesound --mode off      Disable popup, keep sound");
  console.log("    npx claudesound --uninstall     Remove managed hooks and assets");
  console.log("    npx claudesound --help          Show this help");
  console.log("");
}

async function install(cliMode) {
  const notificationMode = resolveNotificationMode({ platform, cliMode });

  console.log("");
  console.log("  claudesound");
  console.log("  Teams-style notifications for Claude Code");
  console.log("  ------------------------------------------------");
  console.log(`  Visual mode: ${notificationMode}`);

  const sound = await pickSound();

  fs.mkdirSync(SOUNDS_DIR, { recursive: true });
  process.stdout.write(`  Installing "${sound.name}" sound... `);
  await download(`${SOUND_BASE_URL}/${sound.file}`, SOUND_FILE);
  console.log("done");

  process.stdout.write("  Setting up notification icon... ");
  const iconSetup = setupNotificationIcon(notificationMode);
  console.log(iconSetup.message);

  process.stdout.write("  Updating Claude Code settings... ");
  const settings = readSettings();
  const updatedSettings = applyManagedHooks(settings, {
    platform,
    notificationMode,
    soundFile: SOUND_FILE,
    iconFile: iconSetup.iconFile,
  });
  writeSettings(updatedSettings);
  console.log("done");

  console.log("");
  console.log("  Sending test notification...");
  previewHooks(notificationMode);

  console.log("");
  console.log("  Installed. Restart Claude Code to activate.");
  console.log("  Change mode later with: npx claudesound --mode custom|native|off");
  console.log("  Remove everything with: npx claudesound --uninstall");
  console.log("");
}

function cleanupFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return false;
  }

  fs.rmSync(filePath, { force: true });
  return true;
}

function cleanupDirIfEmpty(dirPath) {
  try {
    fs.rmdirSync(dirPath);
  } catch {}
}

function uninstall() {
  console.log("");
  console.log("  claudesound - uninstalling");
  console.log("  --------------------------");
  console.log("");

  if (fs.existsSync(SETTINGS_FILE)) {
    process.stdout.write("  Removing managed hooks... ");
    const settings = readSettings();
    const cleaned = removeManagedHooks(settings);
    if (Object.keys(cleaned).length > 0) {
      writeSettings(cleaned);
    } else {
      fs.rmSync(SETTINGS_FILE, { force: true });
    }
    console.log("done");
  } else {
    console.log("  No Claude Code settings file found.");
  }

  if (cleanupFile(SOUND_FILE)) {
    console.log("  Removed sound file.");
  }

  if (cleanupFile(TEAMS_ICON_FILE)) {
    console.log("  Removed Teams popup icon.");
  }

  if (cleanupFile(LEGACY_ICON_FILE)) {
    console.log("  Removed legacy Claude icon.");
  }

  cleanupDirIfEmpty(SOUNDS_DIR);
  cleanupDirIfEmpty(ASSETS_DIR);

  console.log("");
  console.log("  Uninstall complete.");
  console.log("");
}

async function main() {
  const options = parseArgs(process.argv.slice(2));

  if (options.help) {
    printHelp();
    return;
  }

  if (options.uninstall) {
    uninstall();
    return;
  }

  await install(options.mode);
}

main().catch((err) => {
  console.error(`\n  Error: ${err.message}`);
  process.exit(1);
});
