import type { Config } from "@netlify/functions";
import { db } from "../../db/index.js";
import { physicians } from "../../db/schema.js";
import { eq } from "drizzle-orm";

export default async (req: Request) => {
  const url = new URL(req.url);
  const license = url.searchParams.get("license");

  if (req.method === "GET") {
    if (license) {
      const [physician] = await db.select().from(physicians).where(eq(physicians.license, license));
      if (!physician) return new Response("Not found", { status: 404 });
      return Response.json(physician);
    }
    const all = await db.select().from(physicians).orderBy(physicians.name);
    return Response.json(all);
  }

  if (req.method === "POST") {
    const body = await req.json();
    const [created] = await db.insert(physicians).values({
      license: body.license,
      name: body.name,
      graduationDate: body.graduationDate ? new Date(body.graduationDate) : null,
      specializations: body.specializations ?? "",
    }).returning();
    return Response.json(created, { status: 201 });
  }

  if (req.method === "PUT") {
    if (!license) return new Response("license required", { status: 400 });
    const body = await req.json();
    const [updated] = await db.update(physicians).set({
      name: body.name,
      graduationDate: body.graduationDate ? new Date(body.graduationDate) : null,
      specializations: body.specializations ?? "",
    }).where(eq(physicians.license, license)).returning();
    if (!updated) return new Response("Not found", { status: 404 });
    return Response.json(updated);
  }

  if (req.method === "DELETE") {
    if (!license) return new Response("license required", { status: 400 });
    await db.delete(physicians).where(eq(physicians.license, license));
    return new Response(null, { status: 204 });
  }

  return new Response("Method not allowed", { status: 405 });
};

export const config: Config = { path: "/api/physicians" };
