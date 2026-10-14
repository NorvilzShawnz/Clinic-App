// Clinic office hours and time-zone math. Office hours are wall-clock times in the clinic's
// own time zone, so "8 AM" means the same thing no matter where the server or browser runs.

const DEFAULT_TIME_ZONE = "America/New_York";

export const OPEN_HOUR = 8;
export const CLOSE_HOUR = 17;

export function isValidTimeZone(tz: unknown): tz is string {
  if (typeof tz !== "string" || !tz || tz.length > 64) return false;
  try { new Intl.DateTimeFormat("en-US", { timeZone: tz }); return true; } catch { return false; }
}

export const CLINIC_TIME_ZONE = isValidTimeZone(process.env.CLINIC_TIME_ZONE) ? process.env.CLINIC_TIME_ZONE : DEFAULT_TIME_ZONE;

export type WallTime = { year: number; month: number; day: number; hour: number; minute: number };

const formatters = new Map<string, Intl.DateTimeFormat>();

// The wall-clock date and time of an instant in the given zone.
export function wallTime(date: Date, timeZone = CLINIC_TIME_ZONE): WallTime {
  let fmt = formatters.get(timeZone);
  if (!fmt) {
    fmt = new Intl.DateTimeFormat("en-US", {
      timeZone, hourCycle: "h23", year: "numeric", month: "numeric", day: "numeric", hour: "numeric", minute: "numeric",
    });
    formatters.set(timeZone, fmt);
  }
  const p = Object.fromEntries(fmt.formatToParts(date).map(x => [x.type, x.value]));
  return { year: +p.year, month: +p.month, day: +p.day, hour: +p.hour, minute: +p.minute };
}

// The instant at which the zone's clocks show the given wall time. During a DST gap the
// result is shifted forward by the gap, as wall clocks would be.
export function fromWallTime(w: WallTime, timeZone = CLINIC_TIME_ZONE): Date {
  const target = Date.UTC(w.year, w.month - 1, w.day, w.hour, w.minute);
  let t = target;
  for (let i = 0; i < 3; i++) {
    const seen = wallTime(new Date(t), timeZone);
    const diff = target - Date.UTC(seen.year, seen.month - 1, seen.day, seen.hour, seen.minute);
    if (!diff) break;
    t += diff;
  }
  return new Date(t);
}

export function formatHour(hour: number): string {
  if (hour === 0 || hour === 24) return "12 AM";
  if (hour === 12) return "12 PM";
  return hour < 12 ? `${hour} AM` : `${hour - 12} PM`;
}

export function officeHoursLabel(timeZone = CLINIC_TIME_ZONE): string {
  const zone = new Intl.DateTimeFormat("en-US", { timeZone, timeZoneName: "long" })
    .formatToParts(new Date()).find(p => p.type === "timeZoneName")?.value ?? timeZone;
  return `${formatHour(OPEN_HOUR)} – ${formatHour(CLOSE_HOUR)} ${zone}`;
}

// True when [start, end) lies within one day's office hours in the clinic's time zone.
export function withinOfficeHours(start: Date, end: Date, timeZone = CLINIC_TIME_ZONE): boolean {
  const day = wallTime(start, timeZone);
  const open  = fromWallTime({ ...day, hour: OPEN_HOUR, minute: 0 }, timeZone);
  const close = fromWallTime({ ...day, hour: CLOSE_HOUR, minute: 0 }, timeZone);
  return start >= open && end <= close && end > start;
}
