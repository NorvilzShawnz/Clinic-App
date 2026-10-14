import type { Config } from "@netlify/functions";
import { seedIfEmpty } from "../../db/seed.js";
import { handle, json, error } from "../../lib/http.js";

export default handle(async (req: Request) => {
  if (req.method !== "POST") return error(405, "Send a POST request to seed the database");

  const result = await seedIfEmpty();

  if (!result.seeded) {
    return json({ message: "Database already has data, skipping seed", patients: result.patients, physicians: result.physicians });
  }

  return json({
    message: "Seed data inserted successfully",
    patients: result.patients,
    physicians: result.physicians,
    appointments: result.appointments,
  }, 201);
});

export const config: Config = { path: "/api/seed" };
