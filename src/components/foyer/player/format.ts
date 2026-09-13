export function formatClock(iso: string, timeZone: string) {
  try {
    return new Intl.DateTimeFormat("en-GB", {
      timeZone: timeZone || "UTC",
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).format(new Date(iso));
  } catch {
    try {
      return new Date(iso).toISOString().slice(11, 16);
    } catch {
      return "";
    }
  }
}

export function formatWhen(iso: string, timeZone: string) {
  try {
    return new Intl.DateTimeFormat("en-GB", {
      timeZone: timeZone || "UTC",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).format(new Date(iso));
  } catch {
    return "";
  }
}

export function formatSpan(startIso: string, endIso: string, timeZone: string) {
  const start = formatWhen(startIso, timeZone);
  const end = endIso ? formatWhen(endIso, timeZone) : "";
  if (start && end && start !== end) return `${start} – ${end}`;
  return start;
}

const WELCOME_SOON_MS = 15 * 60_000;

export function welcomeStartLine(startIso: string, nowIso: string, timeZone: string) {
  const start = Date.parse(startIso);
  const now = Date.parse(nowIso);
  if (!Number.isFinite(start) || !Number.isFinite(now)) return "";
  const delta = start - now;
  if (delta <= 0) return "Starting soon";
  if (delta <= WELCOME_SOON_MS) {
    const minutes = Math.max(1, Math.ceil(delta / 60_000));
    return minutes === 1 ? "Starting in 1 minute" : `Starting in ${minutes} minutes`;
  }
  return formatWhen(startIso, timeZone);
}
