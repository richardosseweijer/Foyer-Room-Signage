import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { loadPair, persistPair, recoverPersistPair, secretsAfterLoad } from "./persist.ts";
import { emptySecrets } from "./secrets.ts";
import { emptySite } from "./site.ts";

function pairDir() {
  return mkdtempSync(join(tmpdir(), "foyer-persist-"));
}

test("second write failure leaves previous secrets file unchanged", () => {
  const dir = pairDir();
  const secrets = join(dir, "foyer-secrets.json");
  const site = join(dir, "foyer-site.json");
  writeFileSync(secrets, JSON.stringify({ pin: "old-secret" }));
  writeFileSync(site, JSON.stringify({ site: "old" }));
  const before = readFileSync(secrets, "utf8");
  const rename = (staged: string, target: string) => {
    if (String(target).endsWith("foyer-site.json")) {
      throw Object.assign(new Error("simulated site write fail"), { code: "EIO" });
    }
    renameSync(staged, target);
  };
  assert.throws(() => persistPair(secrets, site, JSON.stringify({ pin: "new-secret" }), JSON.stringify({ site: "new" }), { rename }));
  assert.equal(readFileSync(secrets, "utf8"), before);
  assert.equal(JSON.parse(readFileSync(site, "utf8")).site, "old");
});

test("successful paired save maintains a matching last-good pair", () => {
  const dir = pairDir();
  const secrets = join(dir, "foyer-secrets.json");
  const site = join(dir, "foyer-site.json");
  persistPair(secrets, site, "secret-1", "site-1");
  assert.equal(readFileSync(`${secrets}.good`, "utf8"), "secret-1");
  assert.equal(readFileSync(`${site}.good`, "utf8"), "site-1");
  assert.equal(existsSync(`${site}.transaction`), false);
});

test("boot recovery completes a paired save interrupted after the secrets rename", () => {
  const dir = pairDir();
  const secrets = join(dir, "foyer-secrets.json");
  const site = join(dir, "foyer-site.json");
  writeFileSync(secrets, "secret-old");
  writeFileSync(site, "site-old");
  writeFileSync(`${site}.transaction`, JSON.stringify({ secretBody: "secret-new", siteBody: "site-new" }));
  writeFileSync(secrets, "secret-new");
  assert.equal(recoverPersistPair(secrets, site), true);
  assert.equal(readFileSync(secrets, "utf8"), "secret-new");
  assert.equal(readFileSync(site, "utf8"), "site-new");
  assert.equal(readFileSync(`${secrets}.good`, "utf8"), "secret-new");
  assert.equal(readFileSync(`${site}.good`, "utf8"), "site-new");
  assert.equal(existsSync(`${site}.transaction`), false);
});

test("corrupt transaction is set aside and does not throw", () => {
  const dir = pairDir();
  const secrets = join(dir, "foyer-secrets.json");
  const site = join(dir, "foyer-site.json");
  writeFileSync(secrets, "secret-ok");
  writeFileSync(site, "site-ok");
  writeFileSync(`${site}.transaction`, "{not json");
  assert.equal(recoverPersistPair(secrets, site), false);
  assert.equal(readFileSync(secrets, "utf8"), "secret-ok");
  assert.equal(readFileSync(site, "utf8"), "site-ok");
  assert.equal(existsSync(`${site}.transaction`), false);
  assert.equal(existsSync(`${site}.transaction.bad`), true);
});

test("corrupt site is set aside and last-good pair is used", () => {
  const dir = pairDir();
  const secrets = join(dir, "foyer-secrets.json");
  const sitePath = join(dir, "foyer-site.json");
  const site = emptySite();
  site.name = "Kept";
  const secretsBody = JSON.stringify({
    v: 1,
    sitePinHash: "scrypt$aa$aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    techPinHash: "",
    sitePinMustChange: true,
    displayTokens: {},
    icsUrls: {},
    relaySecret: "",
  });
  persistPair(secrets, sitePath, secretsBody, JSON.stringify(site));
  writeFileSync(sitePath, "{broken");
  const loaded = loadPair(secrets, sitePath);
  assert.equal(loaded.source, "good");
  assert.equal(loaded.site.name, "Kept");
  assert.equal(existsSync(`${sitePath}.bad`), true);
});

test("missing files boot empty site, not a wipe of a later healthy pair", () => {
  const dir = pairDir();
  const loaded = loadPair(join(dir, "foyer-secrets.json"), join(dir, "foyer-site.json"));
  assert.equal(loaded.source, "empty");
  assert.equal(loaded.site.name, "Untitled site");
  assert.equal(loaded.site.timezone, "Europe/Amsterdam");
  assert.equal(loaded.secrets.sitePinMustChange, true);
  assert.ok(loaded.secrets.sitePinHash.startsWith("scrypt$"));
});

test("secretsAfterLoad mints a site PIN without wiping ICS URLs", () => {
  const loaded = emptySecrets();
  loaded.icsUrls = { shared: "https://calendar.google.com/calendar/ical/secret/basic.ics" };
  loaded.sitePinHash = "";
  const next = secretsAfterLoad(loaded);
  assert.ok(next.sitePinHash.startsWith("scrypt$"));
  assert.equal(next.icsUrls.shared?.includes("secret"), true);
  assert.equal(next.sitePinMustChange, true);
});

