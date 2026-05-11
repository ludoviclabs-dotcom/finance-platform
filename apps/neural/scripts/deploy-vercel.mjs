import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const appRoot = path.resolve(__dirname, "..");
const repoRoot = path.resolve(appRoot, "../..");
const appVercelDir = path.join(appRoot, ".vercel");
const appProjectJsonPath = path.join(appVercelDir, "project.json");
const repoVercelDir = path.join(repoRoot, ".vercel");
const repoProjectJsonPath = path.join(repoVercelDir, "project.json");

function fail(message) {
  console.error(message);
  process.exit(1);
}

if (!fs.existsSync(appProjectJsonPath)) {
  fail(`Missing Vercel project link: ${appProjectJsonPath}`);
}

const args = process.argv.slice(2);
const appProjectJsonRaw = fs.readFileSync(appProjectJsonPath, "utf8");
const repoProjectJsonBackup = fs.existsSync(repoProjectJsonPath)
  ? fs.readFileSync(repoProjectJsonPath, "utf8")
  : null;

fs.mkdirSync(repoVercelDir, { recursive: true });
fs.writeFileSync(repoProjectJsonPath, appProjectJsonRaw, "utf8");

let exitCode = 1;
const deployEnv = {
  ...process.env,
  NO_UPDATE_NOTIFIER: "1",
  VERCEL_CLI_UPDATE_NOTIFIER: "0",
};

try {
  const result =
    process.platform === "win32"
      ? spawnSync("cmd.exe", ["/d", "/s", "/c", "vercel", ".", ...args], {
          cwd: repoRoot,
          stdio: "inherit",
          env: deployEnv,
        })
      : spawnSync("vercel", [".", ...args], {
          cwd: repoRoot,
          stdio: "inherit",
          env: deployEnv,
        });

  if (result.error) {
    fail(`Failed to launch Vercel CLI: ${result.error.message}`);
  }

  exitCode = result.status ?? 1;
} finally {
  if (repoProjectJsonBackup === null) {
    fs.rmSync(repoProjectJsonPath, { force: true });
  } else {
    fs.writeFileSync(repoProjectJsonPath, repoProjectJsonBackup, "utf8");
  }
}

process.exit(exitCode);
