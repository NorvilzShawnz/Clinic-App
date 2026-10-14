import { describe, it, expect, vi } from "vitest";
import { handle, readBody, parseId, optionalId, requiredText, optionalText, optionalDate, maskSsn, HttpError } from "../lib/http.js";
import { request } from "./fake-db.js";

const run = async (err: unknown) => {
  const res = await handle(async () => { throw err; })(request("GET", "/"));
  return { status: res.status, body: await res.json() };
};

describe("handle", () => {
  it("passes successful responses through", async () => {
    const res = await handle(async () => Response.json({ ok: true }))(request("GET", "/"));
    expect(res.status).toBe(200);
  });
  it("turns HttpError into a JSON error response", async () => {
    expect(await run(new HttpError(404, "nope"))).toEqual({ status: 404, body: { error: "nope" } });
  });
  it("maps unique violations to 409, including Drizzle-wrapped errors", async () => {
    expect((await run({ code: "23505" })).status).toBe(409);
    expect((await run({ cause: { code: "23505" } })).status).toBe(409);
  });
  it("maps foreign-key violations to 400", async () => {
    expect((await run({ cause: { code: "23503" } })).status).toBe(400);
  });
  it("hides details of unexpected errors", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await run(new Error("connection string leaked"))).toEqual({ status: 500, body: { error: "Internal server error" } });
  });
});

describe("readBody", () => {
  it("parses a JSON object", async () => {
    expect(await readBody(request("POST", "/", { a: 1 }))).toEqual({ a: 1 });
  });
  it.each([["not json"], ["[1,2]"], ["null"], ["42"], [""]])("rejects %j", async body => {
    await expect(readBody(request("POST", "/", body))).rejects.toMatchObject({ status: 400 });
  });
});

describe("parseId", () => {
  it("accepts positive integers", () => {
    expect(parseId("1")).toBe(1);
    expect(parseId("2147483647")).toBe(2147483647);
  });
  it.each(["", "0", "-1", "abc", "1.5", "1e3", " 1", "2147483648", "0x10"])("rejects %j", v => {
    expect(() => parseId(v)).toThrow(HttpError);
  });
  it("reports a missing id", () => {
    expect(() => parseId(null)).toThrow("id is required");
  });
  it("optionalId allows empty values", () => {
    expect(optionalId(null, "x")).toBeNull();
    expect(optionalId("", "x")).toBeNull();
    expect(optionalId(7, "x")).toBe(7);
  });
});

describe("text and date fields", () => {
  it("trims text and enforces length", () => {
    expect(requiredText("  Ann  ", "name")).toBe("Ann");
    expect(() => requiredText("   ", "name")).toThrow("name is required");
    expect(() => optionalText("x".repeat(201), "name")).toThrow("at most 200");
    expect(() => optionalText(5, "name")).toThrow("must be a string");
    expect(optionalText(undefined, "name")).toBe("");
  });
  it("parses dates and rejects garbage", () => {
    expect(optionalDate("1990-07-09", "d")?.toISOString()).toBe("1990-07-09T00:00:00.000Z");
    expect(optionalDate("", "d")).toBeNull();
    expect(() => optionalDate("2024-02-30x", "d")).toThrow("not a valid date");
    expect(() => optionalDate(123, "d")).toThrow("must be a date string");
  });
});

describe("maskSsn", () => {
  it("keeps only the last four digits", () => {
    expect(maskSsn("412-55-7831")).toBe("***-**-7831");
    expect(maskSsn("412557831")).toBe("***-**-7831");
  });
  it("returns nothing for empty or too-short values", () => {
    expect(maskSsn("")).toBe("");
    expect(maskSsn(null)).toBe("");
    expect(maskSsn("12")).toBe("");
  });
});
