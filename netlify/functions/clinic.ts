import type { Config } from "@netlify/functions";
import { CLINIC_TIME_ZONE, OPEN_HOUR, CLOSE_HOUR, officeHoursLabel } from "../../lib/clinic.js";
import { handle, json, error } from "../../lib/http.js";

// Office hours and time zone, so the calendar can lay itself out by the same rules the API enforces.
export default handle(async (req: Request) => {
  if (req.method !== "GET") return error(405, "Method not allowed");
  return json({ timeZone: CLINIC_TIME_ZONE, openHour: OPEN_HOUR, closeHour: CLOSE_HOUR, label: officeHoursLabel() });
});

export const config: Config = { path: "/api/clinic" };
