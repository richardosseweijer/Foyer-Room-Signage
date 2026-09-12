import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { gitIdentity, packageVersion, startGithubUpdate } from "./update.ts";

test("packageVersion reads this tree", () => {
  const version = packageVersion();
  assert.match(version, /^\d+\.\d+/);
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
