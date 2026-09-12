import { FIRST_SITE_PIN } from "./pins.ts";
import { parseSecrets, type Secrets } from "./types.ts";

export const SECRET_FIELD_NAMES = ["sitePinHash", "techPinHash", "displayTokens", "icsUrls", "relaySecret"] as const;

export function emptySecrets(): Secrets {
  return {
    v: 1,
    sitePinHash: "",
    techPinHash: "",
    sitePinMustChange: true,
    displayTokens: {},
    icsUrls: {},
    relaySecret: "",
  };
}

export function parseSecretsJson(raw: string): { success: true; data: Secrets } | { success: false } {
  try {
    const parsed = parseSecrets(JSON.parse(raw));
    if (parsed.success) return { success: true, data: parsed.data };
    return { success: false };
  } catch {
    return { success: false };
  }
}

/** Strip secrets from a site/config export. Never include ICS URLs or PIN hashes. */
export function redactSecrets<T extends Record<string, unknown>>(value: T) {
  const out: Record<string, unknown> = { ...value };
  for (const key of SECRET_FIELD_NAMES) delete out[key];
  delete out.pin;
  delete out.sitePin;
  delete out.techPin;
  delete out.icsUrl;
  delete out.icsUrls;
  delete out.peerSecret;
  return out;
}

export function secretsContainPlainPin(secrets: Secrets) {
  const hashes = [secrets.sitePinHash, secrets.techPinHash, ...Object.values(secrets.displayTokens)];
  return hashes.some((item) => item && !item.startsWith("scrypt$") && item === FIRST_SITE_PIN);
}

export { FIRST_SITE_PIN };
