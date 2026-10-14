import { describe, it, expect } from "vitest";
import { wallTime, fromWallTime, withinOfficeHours, isValidTimeZone, formatHour, officeHoursLabel, CLINIC_TIME_ZONE, OPEN_HOUR, CLOSE_HOUR } from "../lib/clinic.js";

const NY = "America/New_York";
const iso = (s: string) => new Date(s);

describe("configuration", () => {
  it("reads the clinic time zone from CLINIC_TIME_ZONE", () => {
    expect(CLINIC_TIME_ZONE).toBe("UTC");
  });
  it("opens at 8 AM and closes at 5 PM", () => {
    expect([OPEN_HOUR, CLOSE_HOUR]).toEqual([8, 17]);
    expect(officeHoursLabel("UTC")).toBe("8 AM – 5 PM Coordinated Universal Time");
  });
  it.each([["America/New_York", true], ["UTC", true], ["Mars/Olympus", false], ["", false], [5, false], [undefined, false]])(
    "isValidTimeZone(%j) is %s", (tz, ok) => expect(isValidTimeZone(tz)).toBe(ok));
  it.each([[0, "12 AM"], [8, "8 AM"], [12, "12 PM"], [17, "5 PM"], [24, "12 AM"]])("formatHour(%i) is %s", (h, s) =>
    expect(formatHour(h)).toBe(s));
});

describe("wallTime / fromWallTime", () => {
  it("converts between instants and New York wall time in summer and winter", () => {
    expect(wallTime(iso("2026-07-01T12:00:00Z"), NY)).toEqual({ year: 2026, month: 7, day: 1, hour: 8, minute: 0 });
    expect(wallTime(iso("2026-12-01T13:00:00Z"), NY)).toEqual({ year: 2026, month: 12, day: 1, hour: 8, minute: 0 });
    expect(fromWallTime({ year: 2026, month: 7, day: 1, hour: 8, minute: 0 }, NY).toISOString()).toBe("2026-07-01T12:00:00.000Z");
    expect(fromWallTime({ year: 2026, month: 12, day: 1, hour: 8, minute: 0 }, NY).toISOString()).toBe("2026-12-01T13:00:00.000Z");
  });
  it("reports midnight as hour 0, not 24", () => {
    expect(wallTime(iso("2026-10-20T04:00:00Z"), NY).hour).toBe(0);
  });
  it("handles DST transition days", () => {
    // 8 AM on the spring-forward and fall-back days.
    expect(fromWallTime({ year: 2026, month: 3, day: 8, hour: 8, minute: 0 }, NY).toISOString()).toBe("2026-03-08T12:00:00.000Z");
    expect(fromWallTime({ year: 2026, month: 11, day: 1, hour: 8, minute: 0 }, NY).toISOString()).toBe("2026-11-01T13:00:00.000Z");
  });
  it("moves a time inside the spring-forward gap forward", () => {
    expect(fromWallTime({ year: 2026, month: 3, day: 8, hour: 2, minute: 30 }, NY).toISOString()).toBe("2026-03-08T07:30:00.000Z");
  });
  it("rolls over month ends", () => {
    expect(fromWallTime({ year: 2026, month: 10, day: 32, hour: 9, minute: 0 }, "UTC").toISOString()).toBe("2026-11-01T09:00:00.000Z");
  });
});

describe("withinOfficeHours", () => {
  const ny = (start: string, end: string) => withinOfficeHours(iso(start), iso(end), NY);
  it.each([
    ["2026-10-20T12:00:00Z", "2026-10-20T12:30:00Z", true,  "8:00–8:30 AM, opening time"],
    ["2026-10-20T20:30:00Z", "2026-10-20T21:00:00Z", true,  "4:30–5:00 PM, closing time"],
    ["2026-10-20T12:00:00Z", "2026-10-20T21:00:00Z", true,  "the whole working day"],
    ["2026-10-20T11:59:00Z", "2026-10-20T12:30:00Z", false, "starts at 7:59 AM"],
    ["2026-10-20T20:45:00Z", "2026-10-20T21:01:00Z", false, "ends at 5:01 PM"],
    ["2026-10-20T20:45:00Z", "2026-10-20T21:00:30Z", false, "ends 30 seconds after closing"],
    ["2026-10-20T10:00:00Z", "2026-10-20T10:30:00Z", false, "6 AM, though 10 AM UTC"],
    ["2026-10-20T22:00:00Z", "2026-10-20T22:30:00Z", false, "6 PM"],
    ["2026-10-20T20:00:00Z", "2026-10-21T13:00:00Z", false, "runs overnight into the next day"],
    ["2026-10-20T13:00:00Z", "2026-10-20T13:00:00Z", false, "zero length"],
  ])("%s → %s is %s (%s)", (s, e, ok) => expect(ny(s, e)).toBe(ok));

  it("uses the right offset across DST", () => {
    expect(ny("2026-12-01T13:00:00Z", "2026-12-01T13:30:00Z")).toBe(true);   // 8 AM EST
    expect(ny("2026-12-01T12:30:00Z", "2026-12-01T13:30:00Z")).toBe(false);  // 7:30 AM EST
    expect(ny("2026-11-01T13:00:00Z", "2026-11-01T13:30:00Z")).toBe(true);   // fall-back day
  });

  it("defaults to the clinic time zone", () => {
    expect(withinOfficeHours(iso("2026-10-20T08:00:00Z"), iso("2026-10-20T08:30:00Z"))).toBe(true);
    expect(withinOfficeHours(iso("2026-10-20T07:30:00Z"), iso("2026-10-20T08:30:00Z"))).toBe(false);
  });
});
