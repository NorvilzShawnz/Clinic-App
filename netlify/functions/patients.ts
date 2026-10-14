import type { Config } from "@netlify/functions";
import { db } from "../../db/index.js";
import { appointments, patients } from "../../db/schema.js";
import { eq } from "drizzle-orm";
import { handle, json, error, readBody, parseId, requiredText, optionalText, optionalDate, maskSsn, HttpError } from "../../lib/http.js";

type Patient = typeof patients.$inferSelect;

// Full SSNs are write-only: responses carry only the masked value.
const toPublic = (p: Patient) => ({ ...p, ssn: maskSsn(p.ssn) });

function parseSsn(value: unknown): string {
  const s = optionalText(value, "ssn", 11);
  if (!s) return "";
  const digits = s.replace(/-/g, "");
  if (!/^\d{9}$/.test(digits)) throw new HttpError(400, "ssn must be 9 digits (XXX-XX-XXXX)");
  return `${digits.slice(0, 3)}-${digits.slice(3, 5)}-${digits.slice(5)}`;
}

function parseFields(body: Record<string, unknown>) {
  return {
    name: requiredText(body.name, "name"),
    birthday: optionalDate(body.birthday, "birthday"),
    address: optionalText(body.address, "address", 500),
  };
}

export default handle(async (req: Request) => {
  const url = new URL(req.url);
  const idParam = url.searchParams.get("id");

  if (req.method === "GET") {
    if (idParam) {
      const [patient] = await db.select().from(patients).where(eq(patients.id, parseId(idParam)));
      if (!patient) return error(404, "Patient not found");
      return json(toPublic(patient));
    }
    const all = await db.select().from(patients).orderBy(patients.name);
    return json(all.map(toPublic));
  }

  if (req.method === "POST") {
    const body = await readBody(req);
    const [created] = await db.insert(patients).values({ ...parseFields(body), ssn: parseSsn(body.ssn) }).returning();
    return json(toPublic(created), 201);
  }

  if (req.method === "PUT") {
    const id = parseId(idParam);
    const body = await readBody(req);
    // A blank SSN on update keeps the stored value, since clients never see the full number.
    const ssn = parseSsn(body.ssn);
    const [updated] = await db.update(patients)
      .set({ ...parseFields(body), ...(ssn ? { ssn } : {}) })
      .where(eq(patients.id, id))
      .returning();
    if (!updated) return error(404, "Patient not found");
    return json(toPublic(updated));
  }

  if (req.method === "DELETE") {
    const id = parseId(idParam);
    // Removing a patient also removes their appointments.
    const deleted = await db.transaction(async (tx) => {
      await tx.delete(appointments).where(eq(appointments.patientId, id));
      return tx.delete(patients).where(eq(patients.id, id)).returning({ id: patients.id });
    });
    if (!deleted.length) return error(404, "Patient not found");
    return new Response(null, { status: 204 });
  }

  return error(405, "Method not allowed");
});

export const config: Config = { path: "/api/patients" };
