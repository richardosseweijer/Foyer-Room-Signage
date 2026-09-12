import {
  closeSync,
  existsSync,
  fsyncSync,
  mkdirSync,
  openSync,
  readFileSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { hashPin } from "./pins.server.ts";
import { FIRST_SITE_PIN } from "./pins.ts";
import { emptySecrets, parseSecretsJson } from "./secrets.ts";
import { emptySite, parseSiteJson } from "./site.ts";
import type { Secrets, Site } from "./types.ts";

export type RenameFn = (staged: string, target: string) => void;

function handOver(staged: string, target: string, rename: RenameFn) {
  mkdirSync(dirname(target), { recursive: true });
  rename(staged, target);
}

export function writeAtomicFile(target: string, body: string, { rename = renameSync }: { rename?: RenameFn } = {}) {
  const staged = `${target}.tmp`;
  mkdirSync(dirname(target), { recursive: true });
  const fd = openSync(staged, "w");
  try {
    writeFileSync(fd, body, "utf8");
    fsyncSync(fd);
  } finally {
    closeSync(fd);
  }
  handOver(staged, target, rename);
  let dirFd: number | undefined;
  try {
    dirFd = openSync(dirname(target), "r");
    fsyncSync(dirFd);
  } catch {
    /* directory fsync unavailable */
  } finally {
    if (dirFd !== undefined) closeSync(dirFd);
  }
}

function removeIfPresent(file: string) {
  if (existsSync(file)) unlinkSync(file);
}

function setAside(file: string, suffix: string) {
  if (!existsSync(file)) return;
  const dest = `${file}${suffix}`;
  try {
    renameSync(file, dest);
  } catch {
    removeIfPresent(file);
  }
}

export function firstBootSecrets(): Secrets {
  return {
    v: 1,
    sitePinHash: hashPin(FIRST_SITE_PIN),
    techPinHash: "",
    sitePinMustChange: true,
    displayTokens: {},
    icsUrls: {},
    relaySecret: "",
  };
}

/** Keep stored ICS URLs and tokens; only mint a site PIN if the file had none. */
export function secretsAfterLoad(loaded: Secrets): Secrets {
  if (loaded.sitePinHash) return loaded;
  const boot = firstBootSecrets();
  return { ...loaded, sitePinHash: boot.sitePinHash, sitePinMustChange: true };
}

export function recoverPersistPair(secretPath: string, sitePath: string, { rename = renameSync }: { rename?: RenameFn } = {}) {
  const transaction = `${sitePath}.transaction`;
  if (!existsSync(transaction)) return false;
  try {
    const pending = JSON.parse(readFileSync(transaction, "utf8")) as { secretBody?: string; siteBody?: string };
    if (typeof pending?.secretBody !== "string" || typeof pending?.siteBody !== "string") {
      throw new Error("invalid persistence transaction");
    }
    writeAtomicFile(secretPath, pending.secretBody, { rename });
    writeAtomicFile(sitePath, pending.siteBody, { rename });
    writeAtomicFile(`${secretPath}.good`, pending.secretBody, { rename });
    writeAtomicFile(`${sitePath}.good`, pending.siteBody, { rename });
    removeIfPresent(transaction);
    return true;
  } catch {
    try {
      renameSync(transaction, `${transaction}.bad`);
    } catch {
      removeIfPresent(transaction);
    }
    return false;
  }
}

export function persistPair(
  secretPath: string,
  sitePath: string,
  secretBody: string,
  siteBody: string,
  { rename = renameSync }: { rename?: RenameFn } = {},
) {
  const transaction = `${sitePath}.transaction`;
  const previousSecrets = existsSync(secretPath) ? readFileSync(secretPath, "utf8") : null;
  writeAtomicFile(transaction, JSON.stringify({ secretBody, siteBody }), { rename });
  try {
    writeAtomicFile(secretPath, secretBody, { rename });
    writeAtomicFile(sitePath, siteBody, { rename });
  } catch (err) {
    if (previousSecrets !== null) {
      writeAtomicFile(secretPath, previousSecrets, { rename: renameSync });
    } else if (existsSync(secretPath)) {
      unlinkSync(secretPath);
    }
    removeIfPresent(transaction);
    throw err;
  }
  writeAtomicFile(`${secretPath}.good`, secretBody, { rename });
  writeAtomicFile(`${sitePath}.good`, siteBody, { rename });
  removeIfPresent(transaction);
}

export type LoadSource = "primary" | "journal" | "good" | "secrets-missing" | "empty";

export type LoadedPair = {
  site: Site;
  secrets: Secrets;
  source: LoadSource;
};

function readOptional(path: string) {
  if (!existsSync(path)) return null;
  try {
    return readFileSync(path, "utf8");
  } catch {
    return null;
  }
}

export function loadPair(secretPath: string, sitePath: string): LoadedPair {
  const recoveredJournal = recoverPersistPair(secretPath, sitePath);
  const siteRaw = readOptional(sitePath);
  const secretRaw = readOptional(secretPath);
  const siteParsed = siteRaw ? parseSiteJson(siteRaw) : null;
  const secretParsed = secretRaw ? parseSecretsJson(secretRaw) : null;
  const siteOk = siteParsed?.success ? siteParsed.data : null;
  const secretsOk = secretParsed?.success ? secretParsed.data : null;

  if (siteOk && secretsOk) {
    return { site: siteOk, secrets: secretsOk, source: recoveredJournal ? "journal" : "primary" };
  }
  if (siteRaw && !siteOk) setAside(sitePath, ".bad");
  if (secretRaw && !secretsOk) setAside(secretPath, ".bad");

  const goodSiteRaw = readOptional(`${sitePath}.good`);
  const goodSecretRaw = readOptional(`${secretPath}.good`);
  const goodSiteParsed = goodSiteRaw ? parseSiteJson(goodSiteRaw) : null;
  const goodSecretsParsed = goodSecretRaw ? parseSecretsJson(goodSecretRaw) : null;
  const goodSite = goodSiteParsed?.success ? goodSiteParsed.data : null;
  const goodSecrets = goodSecretsParsed?.success ? goodSecretsParsed.data : null;

  const site = siteOk ?? goodSite ?? null;
  const secrets = secretsOk ?? goodSecrets ?? null;
  if (site && secrets) return { site, secrets, source: "good" };
  if (site && !secrets) return { site, secrets: emptySecrets(), source: "secrets-missing" };
  return { site: emptySite(), secrets: firstBootSecrets(), source: "empty" };
}

export function defaultDataPaths(root = process.cwd()) {
  const dir = join(root, "data");
  return {
    dir,
    sitePath: join(dir, "foyer-site.json"),
    secretPath: join(dir, "foyer-secrets.json"),
  };
}
