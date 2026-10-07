import type { Config } from "@netlify/functions";
import { seedIfEmpty } from "../../db/seed.js";

export default async (req: Request) => {
  if (req.method !== "POST") {
    return new Response("Send a POST request to seed the database", { status: 405 });
  }

  const result = await seedIfEmpty();

  if (!result.seeded) {
    return Response.json({ message: "Database already has data, skipping seed", patients: result.patients, physicians: result.physicians }, { status: 200 });
  }

  return Response.json({
    message: "Seed data inserted successfully",
    patients: result.patients,
    physicians: result.physicians,
    appointments: result.appointments,
  }, { status: 201 });
};

export const config: Config = { path: "/api/seed" };
