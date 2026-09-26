import { existsSync, readFileSync } from "node:fs";
import { spawn, spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/** Git identity and updater spawn. No compose, calendar, secrets, or PINs. */

function git(root: string, args: string[]) {
  const result = spawnSync("git", args, { cwd: root, encoding: "utf8" });
  return {
    ok: result.status === 0,
    text: (result.stdout || "").trim(),
  };
}

function looksLikeCheckout(dir: string) {
  return existsSync(join(dir, "package.json")) && existsSync(join(dir, "scripts/update-foyer.mjs"));
}

function walkForCheckout(start: string) {
  let dir = start;
  for (let i = 0; i < 12; i++) {
    if (looksLikeCheckout(dir)) return dir;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return "";
}

/** systemd WorkingDirectory, then walk (bundled server fns are not at src/lib/foyer). */
export function foyerRoot() {
  const top = git(process.cwd(), ["rev-parse", "--show-toplevel"]);
  if (top.ok && top.text && looksLikeCheckout(top.text)) return top.text;
  const here = walkForCheckout(process.cwd());
  if (here) return here;
  try {
    const fromModule = walkForCheckout(dirname(fileURLToPath(import.meta.url)));
    if (fromModule) return fromModule;
  } catch {
    /* import.meta.url unavailable */
  }
  return process.cwd();
}

export function packageRoot(from = process.cwd()) {
  return from;
}

export function packageVersion(root = foyerRoot()) {
  try {
    const raw = JSON.parse(readFileSync(join(root, "package.json"), "utf8")) as { version?: string };
    return raw.version?.trim() || "0.0.0";
  } catch {
    return "0.0.0";
  }
}

export function gitIdentity(root = foyerRoot()) {
  const inside = git(root, ["rev-parse", "--is-inside-work-tree"]);
  const clone = inside.ok && inside.text === "true";
  if (!clone) {
    return { clone: false, sha: "", dirty: false, version: packageVersion(root) };
  }
  const sha = git(root, ["rev-parse", "--short", "HEAD"]).text;
  const dirty =
    !git(root, ["diff", "--quiet", "--", ".", ":(exclude)data", ":(exclude)data/foyer-update.log"]).ok ||
    !git(root, ["diff", "--cached", "--quiet", "--", ".", ":(exclude)data", ":(exclude)data/foyer-update.log"]).ok;
  return { clone: true, sha, dirty, version: packageVersion(root) };
}

export function startGithubUpdate(root = foyerRoot()) {
  const identity = gitIdentity(root);
  if (!identity.clone) return { ok: false as const, reason: "not-git" as const };
  const script = join(root, "scripts/update-foyer.mjs");
  if (!existsSync(script)) return { ok: false as const, reason: "missing" as const };
  const check = spawnSync(process.execPath, ["--check", script], { encoding: "utf8" });
  if (check.status !== 0) return { ok: false as const, reason: "script" as const };
  const child = spawn(process.execPath, [script], {
    cwd: root,
    detached: true,
    stdio: "ignore",
    env: { ...process.env, FOYER_PID: String(process.pid) },
  });
  child.unref();
  return { ok: true as const, pid: child.pid ?? 0, sha: identity.sha, version: identity.version };
}
