import type { Config } from "@netlify/functions";
import { db } from "../../db/index.js";
import { patients } from "../../db/schema.js";
import { eq } from "drizzle-orm";

export default async (req: Request) => {
  const url = new URL(req.url);
  const id = url.searchParams.get("id");

  if (req.method === "GET") {
    if (id) {
      const [patient] = await db.select().from(patients).where(eq(patients.id, parseInt(id)));
      if (!patient) return new Response("Not found", { status: 404 });
      return Response.json(patient);
    }
    const all = await db.select().from(patients).orderBy(patients.name);
    return Response.json(all);
  }

  if (req.method === "POST") {
    const body = await req.json();
    const [created] = await db.insert(patients).values({
      name: body.name,
      birthday: body.birthday ? new Date(body.birthday) : null,
      address: body.address ?? "",
      ssn: body.ssn ?? "",
    }).returning();
    return Response.json(created, { status: 201 });
  }

  if (req.method === "PUT") {
    if (!id) return new Response("id required", { status: 400 });
    const body = await req.json();
    const [updated] = await db.update(patients).set({
      name: body.name,
      birthday: body.birthday ? new Date(body.birthday) : null,
      address: body.address ?? "",
      ssn: body.ssn ?? "",
    }).where(eq(patients.id, parseInt(id))).returning();
    if (!updated) return new Response("Not found", { status: 404 });
    return Response.json(updated);
  }

  if (req.method === "DELETE") {
    if (!id) return new Response("id required", { status: 400 });
    await db.delete(patients).where(eq(patients.id, parseInt(id)));
    return new Response(null, { status: 204 });
  }

  return new Response("Method not allowed", { status: 405 });
};

export const config: Config = { path: "/api/patients" };
