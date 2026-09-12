import { existsSync, readFileSync } from "node:fs";
import { spawn, spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/** Git identity and updater spawn. No compose, calendar, secrets, or PINs. */

export function packageRoot(from = process.cwd()) {
  return from;
}

export function foyerRoot() {
  return join(dirname(fileURLToPath(import.meta.url)), "../../..");
}

export function packageVersion(root = foyerRoot()) {
  try {
    const raw = JSON.parse(readFileSync(join(root, "package.json"), "utf8")) as { version?: string };
    return raw.version?.trim() || "0.0.0";
  } catch {
    return "0.0.0";
  }
}

function git(root: string, args: string[]) {
  const result = spawnSync("git", args, { cwd: root, encoding: "utf8" });
  return {
    ok: result.status === 0,
    text: (result.stdout || "").trim(),
  };
}

export function gitIdentity(root = foyerRoot()) {
  const clone = existsSync(join(root, ".git"));
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
  if (identity.dirty) return { ok: false as const, reason: "dirty" as const };
  const script = join(root, "scripts/update-foyer.mjs");
  if (!existsSync(script)) return { ok: false as const, reason: "missing" as const };
  const child = spawn(process.execPath, [script], {
    cwd: root,
    detached: true,
    stdio: "ignore",
    env: { ...process.env, FOYER_PID: String(process.pid) },
  });
  child.unref();
  return { ok: true as const, pid: child.pid ?? 0, sha: identity.sha, version: identity.version };
}
