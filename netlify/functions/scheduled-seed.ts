import type { Config } from "@netlify/functions";
import { seedIfEmpty } from "../../db/seed.js";

// Runs daily and fills the database with seed data if it is empty.
export default async (req: Request) => {
  const { next_run } = await req.json();
  const result = await seedIfEmpty();

  if (result.seeded) {
    console.log(`Seeded ${result.patients} patients, ${result.physicians} physicians, ${result.appointments} appointments. Next run: ${next_run}`);
  } else {
    console.log(`Database already has data, skipping seed. Next run: ${next_run}`);
  }
};

export const config: Config = { schedule: "@daily" };
