import type { Config } from "@netlify/functions";
import { db } from "../../db/index.js";
import { appointments, patients, physicians } from "../../db/schema.js";
import { and, eq, gt, lt, ne, or, sql } from "drizzle-orm";
import { handle, json, error, readBody, parseId, maskSsn, HttpError } from "../../lib/http.js";
import { parseAppointmentInput, checkSchedulingWindow, findConflicts, conflictMessage, timeFormatter, type AppointmentInput } from "../../lib/scheduling.js";

type Row = {
  appointments: typeof appointments.$inferSelect;
  patients: typeof patients.$inferSelect | null;
  physicians: typeof physicians.$inferSelect | null;
};
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

// Joined patient records carry only the masked SSN.
const toPublic = (row: Row) => ({
  ...row,
  patients: row.patients ? { ...row.patients, ssn: maskSsn(row.patients.ssn) } : null,
});

const joined = () => db
  .select()
  .from(appointments)
  .leftJoin(patients, eq(appointments.patientId, patients.id))
  .leftJoin(physicians, eq(appointments.physicianLicense, physicians.license));

// Validates an appointment against the database and writes it inside one transaction.
// Advisory locks on the patient and physician serialize concurrent bookings for either,
// so two simultaneous requests can't both pass the conflict check.
async function schedule(body: Record<string, unknown>, existingId?: number) {
  const input: AppointmentInput = parseAppointmentInput(body);
  const formatTime = timeFormatter(body.timeZone);

  return db.transaction(async (tx: Tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${"patient:" + input.patientId}))`);
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${"physician:" + input.physicianLicense}))`);

    const [patient] = await tx.select({ name: patients.name }).from(patients).where(eq(patients.id, input.patientId));
    if (!patient) throw new HttpError(400, "Selected patient does not exist");
    const [physician] = await tx.select({ name: physicians.name }).from(physicians).where(eq(physicians.license, input.physicianLicense));
    if (!physician) throw new HttpError(400, "Selected physician does not exist");

    let existing;
    if (existingId !== undefined) {
      [existing] = await tx.select().from(appointments).where(eq(appointments.id, existingId));
      if (!existing) throw new HttpError(404, "Appointment not found");
    }
    checkSchedulingWindow(input, new Date(), existing);

    const candidates = await tx.select().from(appointments).where(and(
      or(eq(appointments.patientId, input.patientId), eq(appointments.physicianLicense, input.physicianLicense)),
      lt(appointments.startTime, input.endTime),
      gt(appointments.endTime, input.startTime),
      existingId !== undefined ? ne(appointments.id, existingId) : undefined,
    ));
    const message = conflictMessage(findConflicts(input, candidates, existingId), { patient: patient.name, physician: physician.name }, formatTime);
    if (message) throw new HttpError(409, message);

    if (existingId === undefined) {
      const [created] = await tx.insert(appointments).values(input).returning();
      return created;
    }
    const [updated] = await tx.update(appointments).set(input).where(eq(appointments.id, existingId)).returning();
    return updated;
  });
}

export default handle(async (req: Request) => {
  const url = new URL(req.url);
  const idParam = url.searchParams.get("id");

  if (req.method === "GET") {
    if (idParam) {
      const rows = await joined().where(eq(appointments.id, parseId(idParam)));
      if (!rows.length) return error(404, "Appointment not found");
      return json(toPublic(rows[0]));
    }
    const rows = await joined().orderBy(appointments.startTime);
    return json(rows.map(toPublic));
  }

  if (req.method === "POST") {
    return json(await schedule(await readBody(req)), 201);
  }

  if (req.method === "PUT") {
    const id = parseId(idParam);
    return json(await schedule(await readBody(req), id));
  }

  if (req.method === "DELETE") {
    const id = parseId(idParam);
    const deleted = await db.delete(appointments).where(eq(appointments.id, id)).returning({ id: appointments.id });
    if (!deleted.length) return error(404, "Appointment not found");
    return new Response(null, { status: 204 });
  }

  return error(405, "Method not allowed");
});

export const config: Config = { path: "/api/appointments" };
