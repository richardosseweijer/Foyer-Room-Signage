import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { foyerRoot, gitIdentity, packageVersion, startGithubUpdate } from "./update.ts";

test("packageVersion reads this tree", () => {
  const version = packageVersion();
  assert.match(version, /^\d+\.\d+/);
});

test("foyerRoot finds the git checkout from cwd", () => {
  const id = gitIdentity(foyerRoot());
  assert.equal(id.clone, true);
  assert.ok(id.sha);
});

test("a folder without .git is not a clone", () => {
  const dir = mkdtempSync(join(tmpdir(), "foyer-update-"));
  writeFileSync(join(dir, "package.json"), JSON.stringify({ version: "9.9.9" }));
  const id = gitIdentity(dir);
  assert.equal(id.clone, false);
  assert.equal(id.sha, "");
  assert.equal(id.version, "9.9.9");
});

test("startGithubUpdate refuses a non-git folder", () => {
  const dir = mkdtempSync(join(tmpdir(), "foyer-update-"));
  writeFileSync(join(dir, "package.json"), JSON.stringify({ version: "0.0.1" }));
  const result = startGithubUpdate(dir);
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.reason, "not-git");
});

test("startGithubUpdate no longer refuses a dirty git tree", async () => {
  const { spawnSync } = await import("node:child_process");
  const { mkdirSync } = await import("node:fs");
  const dir = mkdtempSync(join(tmpdir(), "foyer-update-dirty-"));
  spawnSync("git", ["init"], { cwd: dir, encoding: "utf8" });
  spawnSync("git", ["config", "user.email", "test@example.com"], { cwd: dir, encoding: "utf8" });
  spawnSync("git", ["config", "user.name", "test"], { cwd: dir, encoding: "utf8" });
  writeFileSync(join(dir, "package.json"), JSON.stringify({ version: "0.0.1" }));
  mkdirSync(join(dir, "scripts"), { recursive: true });
  writeFileSync(join(dir, "scripts/update-foyer.mjs"), "console.log(\"noop\");\n");
  spawnSync("git", ["add", "."], { cwd: dir, encoding: "utf8" });
  const commit = spawnSync("git", ["-c", "commit.gpgsign=false", "commit", "-m", "init"], {
    cwd: dir,
    encoding: "utf8",
  });
  assert.equal(commit.status, 0, commit.stderr || commit.stdout);
  writeFileSync(join(dir, "package.json"), JSON.stringify({ version: "0.0.2" }));
  const id = gitIdentity(dir);
  assert.equal(id.clone, true);
  assert.equal(id.dirty, true);
  const result = startGithubUpdate(dir);
  // Spawns the stub updater; must not refuse for dirty
  if (!result.ok) {
    assert.notEqual((result as { reason: string }).reason, "dirty");
  } else {
    assert.ok(result.ok);
  }
});
