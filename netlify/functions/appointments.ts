import type { Config } from "@netlify/functions";
import { db } from "../../db/index.js";
import { appointments, patients, physicians } from "../../db/schema.js";
import { eq } from "drizzle-orm";

export default async (req: Request) => {
  const url = new URL(req.url);
  const id = url.searchParams.get("id");

  if (req.method === "GET") {
    if (id) {
      const rows = await db
        .select()
        .from(appointments)
        .leftJoin(patients, eq(appointments.patientId, patients.id))
        .leftJoin(physicians, eq(appointments.physicianLicense, physicians.license))
        .where(eq(appointments.id, parseInt(id)));
      if (!rows.length) return new Response("Not found", { status: 404 });
      return Response.json(rows[0]);
    }
    const rows = await db
      .select()
      .from(appointments)
      .leftJoin(patients, eq(appointments.patientId, patients.id))
      .leftJoin(physicians, eq(appointments.physicianLicense, physicians.license))
      .orderBy(appointments.startTime);
    return Response.json(rows);
  }

  if (req.method === "POST") {
    const body = await req.json();
    const [created] = await db.insert(appointments).values({
      startTime: body.startTime ? new Date(body.startTime) : null,
      endTime: body.endTime ? new Date(body.endTime) : null,
      patientId: body.patientId ? parseInt(body.patientId) : null,
      physicianLicense: body.physicianLicense ?? null,
    }).returning();
    return Response.json(created, { status: 201 });
  }

  if (req.method === "PUT") {
    if (!id) return new Response("id required", { status: 400 });
    const body = await req.json();
    const [updated] = await db.update(appointments).set({
      startTime: body.startTime ? new Date(body.startTime) : null,
      endTime: body.endTime ? new Date(body.endTime) : null,
      patientId: body.patientId ? parseInt(body.patientId) : null,
      physicianLicense: body.physicianLicense ?? null,
    }).where(eq(appointments.id, parseInt(id))).returning();
    if (!updated) return new Response("Not found", { status: 404 });
    return Response.json(updated);
  }

  if (req.method === "DELETE") {
    if (!id) return new Response("id required", { status: 400 });
    await db.delete(appointments).where(eq(appointments.id, parseInt(id)));
    return new Response(null, { status: 204 });
  }

  return new Response("Method not allowed", { status: 405 });
};

export const config: Config = { path: "/api/appointments" };
