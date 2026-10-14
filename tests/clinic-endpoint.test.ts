import { describe, it, expect } from "vitest";
import handler from "../netlify/functions/clinic.js";

describe("GET /api/clinic", () => {
  it("returns office hours and time zone", async () => {
    const res = await handler(new Request("http://localhost/api/clinic"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ timeZone: "UTC", openHour: 8, closeHour: 17, label: "8 AM – 5 PM Coordinated Universal Time" });
  });
  it("rejects other methods", async () => {
    expect((await handler(new Request("http://localhost/api/clinic", { method: "POST" }))).status).toBe(405);
  });
});
