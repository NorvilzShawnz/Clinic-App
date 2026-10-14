import { describe, it, expect } from "vitest";
import {
  parseTimestamp, parseAppointmentInput, checkSchedulingWindow, overlaps, findConflicts, conflictMessage, timeFormatter,
  type AppointmentInput, type ExistingAppointment,
} from "../lib/scheduling.js";

const NOW = new Date("2026-10-14T12:00:00Z");
const t = (hhmm: string, day = "2026-10-20") => new Date(`${day}T${hhmm}:00Z`);
const YUKI = 11, MARCUS = 10;
const PRIYA = "MD-2019-04821", WILLIAM = "MD-2015-11093";

const input = (over: Partial<AppointmentInput> = {}): AppointmentInput =>
  ({ startTime: t("10:00"), endTime: t("10:30"), patientId: YUKI, physicianLicense: PRIYA, ...over });
const appt = (id: number, start: string, end: string, patientId: number | null, physicianLicense: string | null, day?: string): ExistingAppointment =>
  ({ id, startTime: t(start, day), endTime: t(end, day), patientId, physicianLicense });
const body = (over: Record<string, unknown> = {}) =>
  ({ startTime: "2026-10-20T10:00:00.000Z", endTime: "2026-10-20T10:30:00.000Z", patientId: "11", physicianLicense: PRIYA, ...over });

describe("parseTimestamp", () => {
  it.each(["2026-10-20T10:00:00.000Z", "2026-10-20T10:00Z", "2026-10-20T10:00:00-04:00"])("accepts %s", v => {
    expect(parseTimestamp(v, "startTime")).toBeInstanceOf(Date);
  });
  it.each([
    ["2026-10-20T10:00", "no time zone"],
    ["2026-10-20", "date only"],
    ["10/20/2026 10:00", "non-ISO"],
    ["2026-13-01T10:00Z", "invalid month"],
    [1792500000000, "number"],
  ])("rejects %j (%s)", v => {
    expect(() => parseTimestamp(v, "startTime")).toThrow();
  });
  it("requires a value", () => {
    expect(() => parseTimestamp("", "startTime")).toThrow("startTime is required");
    expect(() => parseTimestamp(null, "endTime")).toThrow("endTime is required");
  });
});

describe("parseAppointmentInput", () => {
  it("parses a valid appointment", () => {
    expect(parseAppointmentInput(body())).toEqual(input());
  });
  it("requires a patient and a physician", () => {
    expect(() => parseAppointmentInput(body({ patientId: "" }))).toThrow("A patient is required");
    expect(() => parseAppointmentInput(body({ patientId: null }))).toThrow("A patient is required");
    expect(() => parseAppointmentInput(body({ physicianLicense: "  " }))).toThrow("A physician is required");
  });
  it("rejects a malformed patient id", () => {
    expect(() => parseAppointmentInput(body({ patientId: "abc" }))).toThrow("patientId must be a positive integer");
  });
  it("rejects zero-length and backwards appointments", () => {
    expect(() => parseAppointmentInput(body({ endTime: "2026-10-20T10:00:00.000Z" }))).toThrow("End time must be after start time");
    expect(() => parseAppointmentInput(body({ endTime: "2026-10-20T09:00:00.000Z" }))).toThrow("End time must be after start time");
  });
  it("enforces minimum and maximum duration", () => {
    expect(() => parseAppointmentInput(body({ endTime: "2026-10-20T10:04:00.000Z" }))).toThrow("at least 5 minutes");
    expect(parseAppointmentInput(body({ endTime: "2026-10-20T10:05:00.000Z" }))).toBeTruthy();
    expect(parseAppointmentInput(body({ endTime: "2026-10-20T22:00:00.000Z" }))).toBeTruthy();
    expect(() => parseAppointmentInput(body({ endTime: "2026-10-20T22:01:00.000Z" }))).toThrow("longer than 12 hours");
  });
  it("compares instants, not wall-clock text, across time zones", () => {
    // 06:30-04:00 is 10:30Z: a valid 30 minute appointment despite the smaller-looking end hour.
    const parsed = parseAppointmentInput(body({ endTime: "2026-10-20T06:30:00-04:00" }));
    expect(parsed.endTime.toISOString()).toBe("2026-10-20T10:30:00.000Z");
  });
  it("allows appointments that span midnight", () => {
    expect(parseAppointmentInput(body({ startTime: "2026-10-20T23:30:00Z", endTime: "2026-10-21T00:15:00Z" }))).toBeTruthy();
  });
});

describe("checkSchedulingWindow", () => {
  it("allows future appointments", () => {
    expect(() => checkSchedulingWindow(input(), NOW)).not.toThrow();
  });
  it("rejects new appointments in the past, with a short grace period", () => {
    const past = input({ startTime: new Date("2026-10-14T11:00:00Z"), endTime: new Date("2026-10-14T11:30:00Z") });
    expect(() => checkSchedulingWindow(past, NOW)).toThrow("in the past");
    const justNow = input({ startTime: new Date("2026-10-14T11:57:00Z"), endTime: new Date("2026-10-14T12:30:00Z") });
    expect(() => checkSchedulingWindow(justNow, NOW)).not.toThrow();
  });
  it("rejects appointments more than two years ahead", () => {
    const far = input({ startTime: new Date("2028-10-20T10:00:00Z"), endTime: new Date("2028-10-20T10:30:00Z") });
    expect(() => checkSchedulingWindow(far, NOW)).toThrow("2 years ahead");
  });
  it("lets a past appointment be edited when its times don't change", () => {
    const pastInput = input({ startTime: new Date("2026-10-01T10:00:00Z"), endTime: new Date("2026-10-01T10:30:00Z"), physicianLicense: WILLIAM });
    const existing = appt(5, "10:00", "10:30", YUKI, PRIYA, "2026-10-01");
    expect(() => checkSchedulingWindow(pastInput, NOW, existing)).not.toThrow();
  });
  it.each([
    ["07:30", "08:00", "before opening"],
    ["16:45", "17:15", "past closing"],
    ["18:00", "18:30", "evening"],
  ])("rejects %s–%s (%s)", (s, e) => {
    expect(() => checkSchedulingWindow(input({ startTime: t(s), endTime: t(e) }), NOW)).toThrow("within office hours (8 AM – 5 PM");
  });
  it("accepts appointments touching opening and closing time", () => {
    expect(() => checkSchedulingWindow(input({ startTime: t("08:00"), endTime: t("08:30") }), NOW)).not.toThrow();
    expect(() => checkSchedulingWindow(input({ startTime: t("16:30"), endTime: t("17:00") }), NOW)).not.toThrow();
  });
  it("rejects appointments running past midnight", () => {
    expect(() => checkSchedulingWindow(input({ startTime: t("16:30"), endTime: t("08:30", "2026-10-21") }), NOW)).toThrow("office hours");
  });
  it("lets an out-of-hours legacy appointment keep its times while other fields change", () => {
    const legacy = appt(5, "06:00", "06:30", YUKI, PRIYA);
    expect(() => checkSchedulingWindow(input({ startTime: t("06:00"), endTime: t("06:30"), physicianLicense: WILLIAM }), NOW, legacy)).not.toThrow();
    expect(() => checkSchedulingWindow(input({ startTime: t("06:15"), endTime: t("06:45") }), NOW, legacy)).toThrow("office hours");
  });
  it("does not let a past appointment be moved to another past time", () => {
    const moved = input({ startTime: new Date("2026-10-02T10:00:00Z"), endTime: new Date("2026-10-02T10:30:00Z") });
    expect(() => checkSchedulingWindow(moved, NOW, appt(5, "10:00", "10:30", YUKI, PRIYA, "2026-10-01"))).toThrow("in the past");
  });
});

describe("overlaps", () => {
  const o = (a: string, b: string, c: string, d: string) => overlaps(t(a), t(b), t(c), t(d));
  it.each([
    ["10:00", "10:30", "10:15", "10:45", true, "partial overlap at the end"],
    ["10:15", "10:45", "10:00", "10:30", true, "partial overlap at the start"],
    ["10:00", "11:00", "10:15", "10:30", true, "contains the other"],
    ["10:15", "10:30", "10:00", "11:00", true, "contained by the other"],
    ["10:00", "10:30", "10:00", "10:30", true, "identical"],
    ["10:00", "10:30", "10:30", "11:00", false, "back-to-back after"],
    ["10:30", "11:00", "10:00", "10:30", false, "back-to-back before"],
    ["10:00", "10:30", "11:00", "11:30", false, "separate"],
  ])("%s-%s vs %s-%s → %s (%s)", (a, b, c, d, expected) => {
    expect(o(a, b, c, d)).toBe(expected);
  });
});

describe("findConflicts", () => {
  it("flags Yuki booking Dr. Priya twice at overlapping times", () => {
    const c = findConflicts(input({ startTime: t("10:15"), endTime: t("10:45") }), [appt(1, "10:00", "10:30", YUKI, PRIYA)]);
    expect(c.patient.map(a => a.id)).toEqual([1]);
    expect(c.physician.map(a => a.id)).toEqual([1]);
  });
  it("flags Yuki overlapping with a different physician", () => {
    const c = findConflicts(input({ physicianLicense: WILLIAM }), [appt(1, "10:00", "10:30", YUKI, PRIYA)]);
    expect(c.patient.map(a => a.id)).toEqual([1]);
    expect(c.physician).toEqual([]);
  });
  it("flags Dr. Priya double-booked with a different patient", () => {
    const c = findConflicts(input(), [appt(1, "10:00", "10:30", MARCUS, PRIYA)]);
    expect(c.patient).toEqual([]);
    expect(c.physician.map(a => a.id)).toEqual([1]);
  });
  it("allows two appointments for Yuki with Dr. Priya on the same day that don't overlap", () => {
    const c = findConflicts(input({ startTime: t("14:00"), endTime: t("14:30") }), [appt(1, "10:00", "10:30", YUKI, PRIYA)]);
    expect(c).toEqual({ patient: [], physician: [] });
  });
  it("allows back-to-back appointments", () => {
    const c = findConflicts(input({ startTime: t("10:30"), endTime: t("11:00") }), [appt(1, "10:00", "10:30", YUKI, PRIYA)]);
    expect(c).toEqual({ patient: [], physician: [] });
  });
  it("ignores unrelated patients and physicians", () => {
    expect(findConflicts(input(), [appt(1, "10:00", "10:30", MARCUS, WILLIAM)])).toEqual({ patient: [], physician: [] });
  });
  it("ignores the appointment being edited", () => {
    const c = findConflicts(input({ endTime: t("11:00") }), [appt(7, "10:00", "10:30", YUKI, PRIYA)], 7);
    expect(c).toEqual({ patient: [], physician: [] });
  });
  it("still checks other appointments while editing", () => {
    const c = findConflicts(input(), [appt(7, "10:00", "10:30", YUKI, PRIYA), appt(8, "10:15", "10:45", YUKI, WILLIAM)], 7);
    expect(c.patient.map(a => a.id)).toEqual([8]);
  });
  it("skips legacy rows with missing times", () => {
    const legacy: ExistingAppointment = { id: 9, startTime: null, endTime: null, patientId: YUKI, physicianLicense: PRIYA };
    expect(findConflicts(input(), [legacy])).toEqual({ patient: [], physician: [] });
  });
  it("finds conflicts on both sides at once", () => {
    const c = findConflicts(input(), [appt(1, "10:00", "10:30", YUKI, WILLIAM), appt(2, "10:10", "10:20", MARCUS, PRIYA)]);
    expect(c.patient.map(a => a.id)).toEqual([1]);
    expect(c.physician.map(a => a.id)).toEqual([2]);
  });
});

describe("conflictMessage", () => {
  const names = { patient: "Yuki Tanaka", physician: "Dr. Priya Krishnamurthy" };
  const fmt = timeFormatter("UTC");
  it("returns null when there are no conflicts", () => {
    expect(conflictMessage({ patient: [], physician: [] }, names)).toBeNull();
  });
  it("reports a same-pair clash once", () => {
    const a = appt(1, "10:00", "10:30", YUKI, PRIYA);
    const msg = conflictMessage({ patient: [a], physician: [a] }, names, fmt)!;
    expect(msg).toContain("Yuki Tanaka already has an appointment at Oct 20, 10:00 AM UTC–Oct 20, 10:30 AM UTC");
    expect(msg).not.toContain("Dr. Priya");
  });
  it("reports patient and physician clashes separately", () => {
    const a = appt(1, "10:00", "10:30", YUKI, WILLIAM), b = appt(2, "10:10", "10:20", MARCUS, PRIYA);
    const msg = conflictMessage({ patient: [a], physician: [b] }, names, fmt)!;
    expect(msg).toContain("Yuki Tanaka already has");
    expect(msg).toContain("Dr. Priya Krishnamurthy is already booked");
  });
  it("still reports a physician clash that differs from the patient's", () => {
    const a = appt(1, "10:00", "10:30", YUKI, PRIYA), b = appt(2, "10:20", "10:40", MARCUS, PRIYA);
    expect(conflictMessage({ patient: [a], physician: [a, b] }, names, fmt)).toContain("Dr. Priya Krishnamurthy is already booked");
  });
});

describe("timeFormatter", () => {
  it("formats in the requested time zone", () => {
    expect(timeFormatter("America/New_York")(t("14:00"))).toMatch(/10:00 AM EDT/);
  });
  it.each([["Not/AZone"], [42], [undefined], ["x".repeat(100)]])("falls back to UTC for %j", z => {
    expect(timeFormatter(z)(t("14:00"))).toMatch(/2:00 PM UTC/);
  });
});
