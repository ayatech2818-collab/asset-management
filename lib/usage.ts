import type { Heartbeat } from "./types";

// Derives usage sessions from the heartbeat stream. A heartbeat counts as
// "in use" when idle_minutes is below the reporting cadence (laptop: input
// within the last 5 min; phone: screen on). Consecutive active beats merge
// into one session; a gap of more than 2x the cadence starts a new one.
// Resolution is therefore the cadence: 5 min for laptops, 15 min for phones.

export type UsageSession = { start: Date; end: Date; minutes: number };

export type DayUsage = {
  key: string;
  label: string;
  sessions: number;
  activeMinutes: number;
};

export function cadenceFor(platform: string): number {
  return platform === "android" || platform === "ios" ? 15 : 5;
}

export function computeSessions(
  heartbeats: Heartbeat[],
  cadenceMin: number,
): UsageSession[] {
  const activeTimes = heartbeats
    .filter((h) => h.idle_minutes != null && h.idle_minutes < cadenceMin)
    .map((h) => new Date(h.reported_at).getTime())
    .sort((a, b) => a - b);

  const maxGapMs = cadenceMin * 2 * 60_000;
  const sessions: UsageSession[] = [];
  for (const t of activeTimes) {
    const current = sessions[sessions.length - 1];
    if (current && t - current.end.getTime() <= maxGapMs) {
      current.end = new Date(t);
    } else {
      sessions.push({ start: new Date(t), end: new Date(t), minutes: 0 });
    }
  }
  for (const s of sessions) {
    // Each beat covers the cadence window leading up to it.
    s.minutes =
      Math.round((s.end.getTime() - s.start.getTime()) / 60_000) + cadenceMin;
  }
  return sessions.reverse(); // newest first
}

export function dailyUsage(sessions: UsageSession[]): DayUsage[] {
  const byDay = new Map<string, DayUsage>();
  for (const s of sessions) {
    const key = s.start.toDateString();
    const day = byDay.get(key) ?? {
      key,
      label: s.start.toLocaleDateString([], {
        weekday: "short",
        day: "numeric",
        month: "short",
      }),
      sessions: 0,
      activeMinutes: 0,
    };
    day.sessions += 1;
    day.activeMinutes += s.minutes;
    byDay.set(key, day);
  }
  return [...byDay.values()];
}

export function fmtMinutes(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export function fmtRange(s: UsageSession): string {
  const t = (d: Date) =>
    d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  return `${t(s.start)} – ${t(s.end)}`;
}
