import { describe, it, expect, vi, beforeEach } from "vitest";
import { createFakeDb, request } from "./fake-db.js";

const fake = vi.hoisted(() => ({ current: null as any }));
vi.mock("../db/index.js", () => ({ get db() { return fake.current.db; } }));

const { createFakeDb: make } = await import("./fake-db.js");
fake.current = make();
const { default: patients } = await import("../netlify/functions/patients.js");
const { default: physicians } = await import("../netlify/functions/physicians.js");

const f = () => fake.current as ReturnType<typeof createFakeDb>;
const send = async (handler: (r: Request) => Promise<Response>, method: string, path: string, b?: unknown) => {
  const res = await handler(request(method, path, b));
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : null };
};
const patient = { id: 1, name: "Yuki Tanaka", birthday: null, address: "", ssn: "504-12-9683", createdAt: null };

beforeEach(() => f().reset());

describe("patients", () => {
  it("never returns full SSNs", async () => {
    f().queue([patient]);
    const list = await send(patients, "GET", "/api/patients");
    expect(list.body[0].ssn).toBe("***-**-9683");
    f().queue([patient]);
    expect((await send(patients, "GET", "/api/patients?id=1")).body.ssn).toBe("***-**-9683");
  });

  it("normalizes SSNs on create", async () => {
    f().queue([patient]);
    await send(patients, "POST", "/api/patients", { name: "Yuki Tanaka", ssn: "504129683" });
    expect(f().payload("insert")).toMatchObject({ ssn: "504-12-9683" });
  });

  it.each(["12", "504-12-968", "abc-de-fghi", "504-12-96833"])("rejects SSN %j", async ssn => {
    expect((await send(patients, "POST", "/api/patients", { name: "Y", ssn })).status).toBe(400);
  });

  it("keeps the stored SSN when an update leaves it blank", async () => {
    f().queue([patient]);
    await send(patients, "PUT", "/api/patients?id=1", { name: "Yuki T", ssn: "" });
    expect(f().payload("update")).not.toHaveProperty("ssn");
  });

  it("requires a name", async () => {
    expect((await send(patients, "POST", "/api/patients", { name: " " })).body.error).toBe("name is required");
  });

  it("deletes the patient's appointments before the patient", async () => {
    f().queue([], [{ id: 1 }]);
    expect((await send(patients, "DELETE", "/api/patients?id=1")).status).toBe(204);
    expect(f().calls.map(c => c.op)).toEqual(["delete", "delete"]);
  });

  it("returns 404 for unknown patients", async () => {
    f().queue([]);
    expect((await send(patients, "GET", "/api/patients?id=9")).status).toBe(404);
    f().queue([], []);
    expect((await send(patients, "DELETE", "/api/patients?id=9")).status).toBe(404);
  });

  it("rejects bad ids", async () => {
    expect((await send(patients, "GET", "/api/patients?id=abc")).status).toBe(400);
  });
});

describe("physicians", () => {
  it("rejects licenses with unsafe characters", async () => {
    expect((await send(physicians, "POST", "/api/physicians", { license: "MD 1'", name: "X" })).status).toBe(400);
  });

  it("maps duplicate licenses to 409", async () => {
    f().db.insert = () => ({ values: () => ({ returning: async () => { throw { cause: { code: "23505" } }; } }) });
    const res = await send(physicians, "POST", "/api/physicians", { license: "MD-1", name: "X" });
    expect(res.status).toBe(409);
    fake.current = make();
  });

  it("deletes the physician's appointments before the physician", async () => {
    f().queue([], [{ license: "MD-1" }]);
    expect((await send(physicians, "DELETE", "/api/physicians?license=MD-1")).status).toBe(204);
    expect(f().calls.map(c => c.op)).toEqual(["delete", "delete"]);
  });
});
