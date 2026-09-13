#!/usr/bin/env node
/** Build an update in an isolated worktree, then switch the verified release. data/ is never copied. */
import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const parent = path.dirname(root);
const stem = path.basename(root).replace(/[^a-zA-Z0-9._-]/g, "-");
const stage = path.join(parent, `.${stem}.foyer-update-${process.pid}`);
const rollback = path.join(parent, `.${stem}.foyer-rollback-${process.pid}`);
const logFile = path.join(root, "data", "foyer-update.log");
const npm = process.platform === "win32" ? "npm.cmd" : "npm";

function log(line) {
  try {
    fs.mkdirSync(path.dirname(logFile), { recursive: true });
    fs.appendFileSync(logFile, `${new Date().toISOString()} ${line}\n`);
  } catch {
    /* logging must not decide update success */
  }
}

function run(cmd, args, cwd = root) {
  log(`$ ${cmd} ${args.join(" ")}`);
  const result = spawnSync(cmd, args, { cwd, encoding: "utf8", shell: process.platform === "win32", env: process.env });
  if (result.stdout) log(result.stdout.trimEnd());
  if (result.stderr) log(result.stderr.trimEnd());
  return result.status === 0;
}

function gitText(args) {
  const result = spawnSync("git", args, { cwd: root, encoding: "utf8", shell: process.platform === "win32" });
  return result.status === 0 ? result.stdout.trim() : "";
}

function removeTree(target) {
  try {
    fs.rmSync(target, { recursive: true, force: true });
  } catch {
    /* cleanup only */
  }
}

function copyBuiltAssets() {
  let copied = false;
  for (const name of ["dist", ".output", ".vinxi"]) {
    const from = path.join(stage, name);
    const to = path.join(root, name);
    if (!fs.existsSync(from)) continue;
    removeTree(to);
    fs.cpSync(from, to, { recursive: true });
    log(`copied ${name}`);
    copied = true;
  }
  if (!copied || !fs.existsSync(path.join(root, "dist"))) {
    throw new Error("staged build produced no dist/");
  }
}

function restore(oldHead) {
  log(`rolling back to ${oldHead}`);
  run("git", ["reset", "--hard", oldHead]);
  const saved = path.join(rollback, "node_modules");
  if (fs.existsSync(saved)) {
    removeTree(path.join(root, "node_modules"));
    fs.renameSync(saved, path.join(root, "node_modules"));
  }
}

function cleanup() {
  run("git", ["worktree", "remove", "--force", stage]);
  removeTree(stage);
  removeTree(rollback);
}

function restartUnits() {
  if (process.platform === "win32") return;
  const units = ["foyer.service", "foyer-panel.service", "foyer-kiosk.service"];
  if (run("systemctl", ["try-restart", ...units])) return;
  const systemctl = fs.existsSync("/usr/bin/systemctl") ? "/usr/bin/systemctl" : "systemctl";
  const sudo = fs.existsSync("/usr/bin/sudo") ? "/usr/bin/sudo" : "sudo";
  run(sudo, ["-n", systemctl, "try-restart", ...units]);
}

if (!fs.existsSync(path.join(root, ".git"))) {
  log("not a git checkout");
  process.exit(2);
}
if (
  !run("git", ["diff", "--quiet", "--", ".", ":(exclude)data", ":(exclude)data/foyer-update.log"]) ||
  !run("git", ["diff", "--cached", "--quiet", "--", ".", ":(exclude)data", ":(exclude)data/foyer-update.log"])
) {
  log("tracked edits present; refusing update");
  process.exit(1);
}

if (!run("git", ["fetch", "--prune", "--force", "--tags", "origin"])) process.exit(1);
const sha = gitText(["rev-parse", "origin/main"]);
const oldHead = gitText(["rev-parse", "HEAD"]);
log(`update ${oldHead} -> ${sha || "origin/main"}`);
if (!oldHead || !sha || !run("git", ["worktree", "add", "--detach", stage, sha])) process.exit(1);

let switched = false;
try {
  if (!run(npm, ["ci", "--include=dev"], stage)) throw new Error("staged npm ci failed");
  if (!run(npm, ["run", "build"], stage)) throw new Error("staged build failed");
  fs.mkdirSync(rollback, { recursive: true });
  if (!run("git", ["checkout", "-f", "-B", "main", sha])) throw new Error("release checkout failed");
  const current = path.join(root, "node_modules");
  const saved = path.join(rollback, "node_modules");
  if (fs.existsSync(current) && !fs.existsSync(saved)) fs.renameSync(current, saved);
  else removeTree(current);
  const built = path.join(stage, "node_modules");
  if (fs.existsSync(built)) fs.renameSync(built, current);
  copyBuiltAssets();
  switched = true;
  log(`release ${gitText(["rev-parse", "HEAD"])} ready`);
} catch (err) {
  log(err instanceof Error ? err.message : String(err));
  if (switched || gitText(["rev-parse", "HEAD"]) !== oldHead) restore(oldHead);
  cleanup();
  process.exit(1);
}

cleanup();
restartUnits();

if (process.env.INVOCATION_ID && process.platform !== "win32") {
  const main = Number(process.env.MAINPID || process.env.FOYER_PID || "");
  if (main) {
    try {
      process.kill(main, "SIGTERM");
    } catch (err) {
      log(String(err));
    }
  }
  process.exit(0);
}

const main = Number(process.env.FOYER_PID || process.env.MAINPID || "");
if (main) {
  try {
    process.kill(main, "SIGTERM");
  } catch (err) {
    log(String(err));
  }
}
log("update finished; Foyer should come back on the welcome listener");
