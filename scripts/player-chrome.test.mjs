import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

test("player chrome has no fullscreen button (door/room plates)", () => {
  const player = readFileSync(join(root, "src/components/foyer/player/Player.tsx"), "utf8");
  assert.equal(/FullscreenButton/.test(player), false);
  assert.equal(/Full screen/.test(player), false);
  assert.equal(existsSync(join(root, "src/components/foyer/player/FullscreenButton.tsx")), false);

  // Setup/config stays separate; no player fullscreen chrome there either.
  const config = readFileSync(join(root, "src/components/foyer/config/ConfigApp.tsx"), "utf8");
  assert.equal(/FullscreenButton/.test(config), false);
  assert.equal(/requestFullscreen/.test(config), false);
});
