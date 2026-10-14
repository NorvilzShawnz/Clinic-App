import type { Config } from "@netlify/functions";
import { db } from "../../db/index.js";
import { appointments, physicians } from "../../db/schema.js";
import { eq } from "drizzle-orm";
import { handle, json, error, readBody, requiredText, optionalText, optionalDate, HttpError } from "../../lib/http.js";

function parseLicense(value: unknown): string {
  const license = requiredText(value, "license", 50);
  if (!/^[A-Za-z0-9-]+$/.test(license)) throw new HttpError(400, "license may contain only letters, digits, and dashes");
  return license;
}

function parseFields(body: Record<string, unknown>) {
  return {
    name: requiredText(body.name, "name"),
    graduationDate: optionalDate(body.graduationDate, "graduationDate"),
    specializations: optionalText(body.specializations, "specializations", 500),
  };
}

export default handle(async (req: Request) => {
  const url = new URL(req.url);
  const licenseParam = url.searchParams.get("license");

  if (req.method === "GET") {
    if (licenseParam) {
      const [physician] = await db.select().from(physicians).where(eq(physicians.license, parseLicense(licenseParam)));
      if (!physician) return error(404, "Physician not found");
      return json(physician);
    }
    const all = await db.select().from(physicians).orderBy(physicians.name);
    return json(all);
  }

  if (req.method === "POST") {
    const body = await readBody(req);
    const [created] = await db.insert(physicians).values({ license: parseLicense(body.license), ...parseFields(body) }).returning();
    return json(created, 201);
  }

  if (req.method === "PUT") {
    const license = parseLicense(licenseParam);
    const body = await readBody(req);
    const [updated] = await db.update(physicians).set(parseFields(body)).where(eq(physicians.license, license)).returning();
    if (!updated) return error(404, "Physician not found");
    return json(updated);
  }

  if (req.method === "DELETE") {
    const license = parseLicense(licenseParam);
    // Removing a physician also removes their appointments.
    const deleted = await db.transaction(async (tx) => {
      await tx.delete(appointments).where(eq(appointments.physicianLicense, license));
      return tx.delete(physicians).where(eq(physicians.license, license)).returning({ license: physicians.license });
    });
    if (!deleted.length) return error(404, "Physician not found");
    return new Response(null, { status: 204 });
  }

  return error(405, "Method not allowed");
});

export const config: Config = { path: "/api/physicians" };
