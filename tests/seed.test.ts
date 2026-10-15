import { describe, expect, it, vi } from "vitest";

vi.mock("../db/index.js", () => ({ db: {} }));

const { buildSeedAppointments } = await import("../db/seed.js");
const { withinOfficeHours } = await import("../lib/clinic.js");
const NOW = new Date("2026-10-14T12:00:00.000Z");

describe("seed appointments", () => {
  it("satisfy the scheduling rules and reference seeded patients and physicians", () => {
    const appointments = buildSeedAppointments(Array.from({ length: 12 }, (_, index) => index + 1), NOW);

    expect(appointments).toHaveLength(14);
    for (const appointment of appointments) {
      expect(appointment.patientId).toBeGreaterThanOrEqual(1);
      expect(appointment.patientId).toBeLessThanOrEqual(12);
      expect(appointment.physicianLicense).toMatch(/^MD-[0-9]{4}-[0-9]{5}$/);
      expect(appointment.startTime.getTime()).toBeGreaterThan(NOW.getTime());
      expect(appointment.endTime.getTime() - appointment.startTime.getTime()).toBeGreaterThanOrEqual(5 * 60 * 1000);
      expect(appointment.endTime.getTime() - appointment.startTime.getTime()).toBeLessThanOrEqual(12 * 60 * 60 * 1000);
      expect(withinOfficeHours(appointment.startTime, appointment.endTime)).toBe(true);
    }

    for (let first = 0; first < appointments.length; first++) {
      for (let second = first + 1; second < appointments.length; second++) {
        const a = appointments[first];
        const b = appointments[second];
        const overlaps = a.startTime < b.endTime && b.startTime < a.endTime;
        expect(overlaps && a.patientId === b.patientId).toBe(false);
        expect(overlaps && a.physicianLicense === b.physicianLicense).toBe(false);
      }
    }
  });
});