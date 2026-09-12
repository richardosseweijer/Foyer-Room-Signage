const TITLE_MAX = 80;
const HOST_MAX = 40;
const MESSAGE_MAX = 200;
const DESCRIPTION_MAX = 240;

function stripMarkup(raw: string) {
  return String(raw ?? "")
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&[#a-zA-Z0-9]+;/g, " ")
    .replace(/[\u0000-\u001F\u007F]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function cap(value: string, max: number) {
  if (value.length <= max) return value;
  return value.slice(0, max).trimEnd();
}

export function sanitizeTitle(raw: string | null | undefined, opts?: { busy?: boolean; fallback?: string }) {
  if (opts?.busy) return "Busy";
  const cleaned = cap(stripMarkup(String(raw ?? "")), TITLE_MAX);
  if (!cleaned) return opts?.fallback ?? "";
  return cleaned;
}

export function sanitizeHost(raw: string | null | undefined, opts?: { busy?: boolean }) {
  if (opts?.busy) return "";
  return cap(stripMarkup(String(raw ?? "")), HOST_MAX);
}

export function sanitizeMessage(raw: string | null | undefined) {
  return cap(stripMarkup(String(raw ?? "")), MESSAGE_MAX);
}

export function sanitizeDescription(raw: string | null | undefined, opts?: { busy?: boolean }) {
  if (opts?.busy) return "";
  return cap(stripMarkup(String(raw ?? "")), DESCRIPTION_MAX);
}

export function sanitizeMeeting(
  meeting: { title: string; host: string; description?: string; startIso: string; endIso: string } | null,
  opts?: { busy?: boolean; emptyTitleFallback?: string },
) {
  if (!meeting) return null;
  const busy = Boolean(opts?.busy);
  const title = sanitizeTitle(meeting.title, { busy, fallback: opts?.emptyTitleFallback ?? "" });
  if (!title && !busy) return null;
  return {
    title: title || (busy ? "Busy" : ""),
    host: sanitizeHost(meeting.host, { busy }),
    description: sanitizeDescription(meeting.description, { busy }),
    startIso: meeting.startIso,
    endIso: meeting.endIso,
  };
}
