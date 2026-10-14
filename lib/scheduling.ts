// Appointment validation and conflict rules. Kept free of database access so they can be unit-tested.
import { HttpError, optionalText, parseId } from "./http.js";
import { withinOfficeHours, officeHoursLabel } from "./clinic.js";

export const MIN_DURATION_MS = 5 * 60 * 1000;
export const MAX_DURATION_MS = 12 * 60 * 60 * 1000;
export const MAX_ADVANCE_MS = 2 * 365 * 24 * 60 * 60 * 1000;
// Tolerates clock skew and the time between filling in the form and submitting it.
export const PAST_GRACE_MS = 5 * 60 * 1000;

export type AppointmentInput = {
  startTime: Date;
  endTime: Date;
  patientId: number;
  physicianLicense: string;
};

export type ExistingAppointment = {
  id: number;
  startTime: Date | null;
  endTime: Date | null;
  patientId: number | null;
  physicianLicense: string | null;
};

// Timestamps must carry an explicit zone (Z or ±hh:mm) so "10:00" can't silently mean 10:00 UTC.
const ISO_WITH_ZONE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?(Z|[+-]\d{2}:\d{2})$/;

export function parseTimestamp(value: unknown, field: string): Date {
  if (value == null || value === "") throw new HttpError(400, `${field} is required`);
  if (typeof value !== "string" || !ISO_WITH_ZONE.test(value)) {
    throw new HttpError(400, `${field} must be an ISO 8601 timestamp with a time zone`);
  }
  const d = new Date(value);
  if (isNaN(d.getTime())) throw new HttpError(400, `${field} is not a valid date`);
  return d;
}

export function parseAppointmentInput(body: Record<string, unknown>): AppointmentInput {
  const startTime = parseTimestamp(body.startTime, "startTime");
  const endTime = parseTimestamp(body.endTime, "endTime");
  const duration = endTime.getTime() - startTime.getTime();
  if (duration <= 0) throw new HttpError(400, "End time must be after start time");
  if (duration < MIN_DURATION_MS) throw new HttpError(400, "Appointments must be at least 5 minutes long");
  if (duration > MAX_DURATION_MS) throw new HttpError(400, "Appointments cannot be longer than 12 hours");

  if (body.patientId == null || body.patientId === "") throw new HttpError(400, "A patient is required");
  const physicianLicense = optionalText(body.physicianLicense, "physicianLicense", 50);
  if (!physicianLicense) throw new HttpError(400, "A physician is required");

  return { startTime, endTime, patientId: parseId(String(body.patientId), "patientId"), physicianLicense };
}

// New times must fall within office hours and may not be in the past or unreasonably far
// ahead. An edit that leaves an existing appointment's times untouched (e.g. reassigning the
// physician) is allowed even if those times predate the current rules.
export function checkSchedulingWindow(input: AppointmentInput, now: Date, existing?: ExistingAppointment) {
  const unchanged = existing
    && existing.startTime?.getTime() === input.startTime.getTime()
    && existing.endTime?.getTime() === input.endTime.getTime();
  if (unchanged) return;
  if (!withinOfficeHours(input.startTime, input.endTime)) {
    throw new HttpError(400, `Appointments must be within office hours (${officeHoursLabel()})`);
  }
  if (input.startTime.getTime() < now.getTime() - PAST_GRACE_MS) {
    throw new HttpError(400, "Appointments cannot be scheduled in the past");
  }
  if (input.startTime.getTime() > now.getTime() + MAX_ADVANCE_MS) {
    throw new HttpError(400, "Appointments cannot be scheduled more than 2 years ahead");
  }
}

// Half-open intervals: an appointment ending at 10:00 doesn't overlap one starting at 10:00.
export function overlaps(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): boolean {
  return aStart.getTime() < bEnd.getTime() && bStart.getTime() < aEnd.getTime();
}

export function findConflicts(input: AppointmentInput, existing: ExistingAppointment[], excludeId?: number) {
  const clashing = existing.filter(a =>
    a.id !== excludeId && a.startTime && a.endTime
    && overlaps(input.startTime, input.endTime, a.startTime, a.endTime));
  return {
    patient: clashing.filter(a => a.patientId === input.patientId),
    physician: clashing.filter(a => a.physicianLicense === input.physicianLicense),
  };
}

export function conflictMessage(
  conflicts: ReturnType<typeof findConflicts>,
  names: { patient: string; physician: string },
  formatTime: (d: Date) => string = d => d.toISOString(),
): string | null {
  const range = (a: ExistingAppointment) => `${formatTime(a.startTime!)}–${formatTime(a.endTime!)}`;
  const parts: string[] = [];
  if (conflicts.patient.length) parts.push(`${names.patient} already has an appointment at ${range(conflicts.patient[0])}`);
  // An appointment with the same patient and physician is already reported above.
  const physicianOnly = conflicts.physician.filter(a => !conflicts.patient.includes(a));
  if (physicianOnly.length) parts.push(`${names.physician} is already booked at ${range(physicianOnly[0])}`);
  return parts.length ? parts.join("; ") : null;
}

// Formats times in the caller's time zone when it sent a valid IANA name, otherwise UTC.
export function timeFormatter(timeZone: unknown): (d: Date) => string {
  let zone = "UTC";
  if (typeof timeZone === "string" && timeZone.length <= 64) {
    try { new Intl.DateTimeFormat("en-US", { timeZone }); zone = timeZone; } catch {}
  }
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: zone, month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZoneName: "short",
  });
  return d => fmt.format(d);
}
