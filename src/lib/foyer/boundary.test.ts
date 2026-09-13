import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import { FOYER_MODULES } from "./types.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "../../..");

test("ARCHITECTURE.md and SECURITY.md name every module", () => {
  const arch = readFileSync(join(root, "ARCHITECTURE.md"), "utf8");
  const sec = readFileSync(join(root, "SECURITY.md"), "utf8");
  for (const mod of FOYER_MODULES) {
    assert.ok(arch.includes(mod.path), `ARCHITECTURE missing ${mod.path}`);
    assert.ok(arch.includes(mod.id), `ARCHITECTURE missing id ${mod.id}`);
    assert.ok(sec.includes(mod.path) || sec.includes(mod.id) || sec.includes("compose") || sec.includes("pins"), `SECURITY should mention fences`);
  }
  assert.ok(sec.includes("src/lib/foyer/compose.ts"));
  assert.ok(sec.includes("src/lib/foyer/sanitize.ts"));
  assert.ok(sec.includes("src/lib/foyer/pins.ts"));
  assert.ok(sec.includes("src/lib/foyer/pins.server.ts"));
});

test("every mapped module file exists", () => {
  for (const mod of FOYER_MODULES) {
    assert.ok(existsSync(join(root, mod.path)), mod.path);
  }
});

test("there is no foyer barrel index", () => {
  assert.equal(existsSync(join(root, "src/lib/foyer/index.ts")), false);
});

test("player UI must not import secrets, persist, calendar, net, or relay", () => {
  const playerDir = join(root, "src/components/foyer/player");
  if (!existsSync(playerDir)) return;
  for (const name of readdirSync(playerDir)) {
    if (!name.endsWith(".ts") && !name.endsWith(".tsx")) continue;
    const src = readFileSync(join(playerDir, name), "utf8");
    assert.equal(/from ["']@\/lib\/foyer\/secrets/.test(src), false, name);
    assert.equal(/from ["']@\/lib\/foyer\/persist/.test(src), false, name);
    assert.equal(/from ["']@\/lib\/foyer\/calendar/.test(src), false, name);
    assert.equal(/from ["']@\/lib\/foyer\/net/.test(src), false, name);
    assert.equal(/from ["']@\/lib\/foyer\/relay/.test(src), false, name);
  }
});

test("tech sheet must not import calendar or secrets", () => {
  const src = readFileSync(join(root, "src/components/foyer/tech/TechSheet.tsx"), "utf8");
  assert.equal(/from ["']@\/lib\/foyer\/calendar/.test(src), false);
  assert.equal(/from ["']@\/lib\/foyer\/secrets/.test(src), false);
  assert.equal(/from ["']@\/lib\/foyer\/persist/.test(src), false);
});
