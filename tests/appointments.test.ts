import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createFakeDb, request } from "./fake-db.js";

const fake = vi.hoisted(() => ({ current: null as any }));
vi.mock("../db/index.js", () => ({ get db() { return fake.current.db; } }));

const { createFakeDb: make } = await import("./fake-db.js");
fake.current = make();
const { default: handler } = await import("../netlify/functions/appointments.js");

const f = () => fake.current as ReturnType<typeof createFakeDb>;
const PRIYA = "MD-2019-04821";
const yuki = { name: "Yuki Tanaka" }, priya = { name: "Dr. Priya Krishnamurthy" };
const body = (over: Record<string, unknown> = {}) => ({
  startTime: "2026-10-20T10:15:00.000Z", endTime: "2026-10-20T10:45:00.000Z",
  patientId: "11", physicianLicense: PRIYA, timeZone: "UTC", ...over,
});
const row = (id: number, start: string, end: string, patientId: number, physicianLicense: string) =>
  ({ id, startTime: new Date(start), endTime: new Date(end), patientId, physicianLicense, createdAt: new Date() });
const send = async (method: string, path: string, b?: unknown) => {
  const res = await handler(request(method, path, b));
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : null };
};

beforeEach(() => {
  f().reset();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-14T12:00:00Z"));
});
afterEach(() => vi.useRealTimers());

describe("POST /api/appointments", () => {
  it("creates a non-conflicting appointment", async () => {
    const created = row(20, "2026-10-20T10:15:00Z", "2026-10-20T10:45:00Z", 11, PRIYA);
    f().queue([yuki], [priya], [], [created]);
    const res = await send("POST", "/api/appointments", body());
    expect(res.status).toBe(201);
    expect(res.body.id).toBe(20);
    expect(f().payload("insert")).toEqual({
      startTime: new Date("2026-10-20T10:15:00Z"), endTime: new Date("2026-10-20T10:45:00Z"), patientId: 11, physicianLicense: PRIYA,
    });
  });

  it("locks the patient and physician before checking for conflicts", async () => {
    f().queue([yuki], [priya], [], [row(20, "2026-10-20T10:15:00Z", "2026-10-20T10:45:00Z", 11, PRIYA)]);
    await send("POST", "/api/appointments", body());
    expect(f().executed).toHaveLength(2);
  });

  it("rejects Yuki double-booking Dr. Priya with 409", async () => {
    f().queue([yuki], [priya], [row(3, "2026-10-20T10:00:00Z", "2026-10-20T10:30:00Z", 11, PRIYA)]);
    const res = await send("POST", "/api/appointments", body());
    expect(res.status).toBe(409);
    expect(res.body.error).toBe("Yuki Tanaka already has an appointment at Oct 20, 10:00 AM UTC–Oct 20, 10:30 AM UTC");
    expect(f().calls.some(c => c.op === "insert")).toBe(false);
  });

  it("rejects Yuki overlapping with another physician", async () => {
    f().queue([yuki], [priya], [row(3, "2026-10-20T10:00:00Z", "2026-10-20T10:30:00Z", 11, "MD-2015-11093")]);
    const res = await send("POST", "/api/appointments", body());
    expect(res.status).toBe(409);
    expect(res.body.error).toContain("Yuki Tanaka already has an appointment");
  });

  it("rejects Dr. Priya being double-booked with another patient", async () => {
    f().queue([yuki], [priya], [row(3, "2026-10-20T10:30:00Z", "2026-10-20T11:00:00Z", 10, PRIYA)]);
    const res = await send("POST", "/api/appointments", body());
    expect(res.status).toBe(409);
    expect(res.body.error).toContain("Dr. Priya Krishnamurthy is already booked");
  });

  it("reports conflicts in the caller's time zone", async () => {
    f().queue([yuki], [priya], [row(3, "2026-10-20T10:00:00Z", "2026-10-20T10:30:00Z", 11, PRIYA)]);
    const res = await send("POST", "/api/appointments", body({ timeZone: "America/New_York" }));
    expect(res.body.error).toContain("6:00 AM EDT");
  });

  it("rejects a patient that doesn't exist", async () => {
    f().queue([], [priya]);
    const res = await send("POST", "/api/appointments", body({ patientId: "999" }));
    expect(res).toEqual({ status: 400, body: { error: "Selected patient does not exist" } });
  });

  it("rejects a physician that doesn't exist", async () => {
    f().queue([yuki], []);
    const res = await send("POST", "/api/appointments", body({ physicianLicense: "MD-0000" }));
    expect(res).toEqual({ status: 400, body: { error: "Selected physician does not exist" } });
  });

  it("rejects appointments outside office hours without querying for conflicts", async () => {
    f().queue([yuki], [priya]);
    const res = await send("POST", "/api/appointments", body({ startTime: "2026-10-20T17:00:00Z", endTime: "2026-10-20T17:30:00Z" }));
    expect(res.status).toBe(400);
    expect(res.body.error).toContain("within office hours");
    expect(f().calls.filter(c => c.op === "select")).toHaveLength(2);
  });

  it("rejects appointments in the past without querying for conflicts", async () => {
    f().queue([yuki], [priya]);
    const res = await send("POST", "/api/appointments", body({ startTime: "2026-10-13T10:00:00Z", endTime: "2026-10-13T10:30:00Z" }));
    expect(res.status).toBe(400);
    expect(res.body.error).toContain("in the past");
  });

  it.each([
    [{ startTime: "" }, "startTime is required"],
    [{ endTime: undefined }, "endTime is required"],
    [{ startTime: "2026-10-20T10:15" }, "time zone"],
    [{ endTime: "2026-10-20T10:15:00Z" }, "End time must be after start time"],
    [{ patientId: null }, "A patient is required"],
    [{ physicianLicense: "" }, "A physician is required"],
  ])("rejects invalid input %j before touching the database", async (over, message) => {
    const res = await send("POST", "/api/appointments", body(over));
    expect(res.status).toBe(400);
    expect(res.body.error).toContain(message);
    expect(f().calls).toHaveLength(0);
  });

  it("rejects malformed JSON", async () => {
    expect((await send("POST", "/api/appointments", "{oops")).status).toBe(400);
  });
});

describe("PUT /api/appointments", () => {
  const existing = row(3, "2026-10-20T10:00:00Z", "2026-10-20T10:30:00Z", 11, PRIYA);

  it("allows extending an appointment over its own old slot", async () => {
    f().queue([yuki], [priya], [existing], [], [{ ...existing, endTime: new Date("2026-10-20T10:45:00Z") }]);
    const res = await send("PUT", "/api/appointments?id=3", body({ startTime: "2026-10-20T10:00:00Z" }));
    expect(res.status).toBe(200);
    expect(f().payload("update")).toMatchObject({ endTime: new Date("2026-10-20T10:45:00Z") });
  });

  it("ignores the edited appointment even if the query returns it", async () => {
    f().queue([yuki], [priya], [existing], [existing], [existing]);
    expect((await send("PUT", "/api/appointments?id=3", body({ startTime: "2026-10-20T10:00:00Z" }))).status).toBe(200);
  });

  it("rejects moving onto another of Yuki's appointments", async () => {
    f().queue([yuki], [priya], [existing], [row(4, "2026-10-20T14:00:00Z", "2026-10-20T14:30:00Z", 11, "MD-2015-11093")]);
    const res = await send("PUT", "/api/appointments?id=3", body({ startTime: "2026-10-20T14:15:00Z", endTime: "2026-10-20T14:45:00Z" }));
    expect(res.status).toBe(409);
  });

  it("returns 404 for a missing appointment", async () => {
    f().queue([yuki], [priya], []);
    expect((await send("PUT", "/api/appointments?id=999", body())).status).toBe(404);
  });

  it("requires a valid id", async () => {
    expect((await send("PUT", "/api/appointments", body())).status).toBe(400);
    expect((await send("PUT", "/api/appointments?id=abc", body())).status).toBe(400);
  });

  it("allows reassigning the physician of a past appointment", async () => {
    const past = row(3, "2026-10-01T10:00:00Z", "2026-10-01T10:30:00Z", 11, PRIYA);
    f().queue([yuki], [{ name: "Dr. William Hartley" }], [past], [], [past]);
    const res = await send("PUT", "/api/appointments?id=3", body({
      startTime: "2026-10-01T10:00:00Z", endTime: "2026-10-01T10:30:00Z", physicianLicense: "MD-2015-11093",
    }));
    expect(res.status).toBe(200);
  });
});

describe("GET and DELETE /api/appointments", () => {
  it("masks SSNs of joined patients", async () => {
    f().queue([{ appointments: row(1, "2026-10-20T10:00:00Z", "2026-10-20T10:30:00Z", 11, PRIYA), patients: { id: 11, name: "Yuki", ssn: "504-12-9683" }, physicians: null }]);
    const res = await send("GET", "/api/appointments");
    expect(res.body[0].patients.ssn).toBe("***-**-9683");
  });

  it("returns 404 when deleting a missing appointment", async () => {
    f().queue([]);
    expect((await send("DELETE", "/api/appointments?id=5")).status).toBe(404);
  });

  it("returns 204 after deleting", async () => {
    f().queue([{ id: 5 }]);
    expect((await send("DELETE", "/api/appointments?id=5")).status).toBe(204);
  });

  it("rejects unsupported methods", async () => {
    expect((await send("PATCH", "/api/appointments")).status).toBe(405);
  });
});
