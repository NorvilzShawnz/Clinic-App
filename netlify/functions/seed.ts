import type { Config } from "@netlify/functions";
import { db } from "../../db/index.js";
import { patients, physicians, appointments } from "../../db/schema.js";
import { count } from "drizzle-orm";

const seedPatients = [
  { name: "Maria Delgado-Cruz",   birthday: new Date("1985-03-14"), address: "742 Elm Street, Springfield, IL 62701",       ssn: "412-55-7831" },
  { name: "James Whitfield",      birthday: new Date("1972-11-28"), address: "1020 Maple Ave, Riverside, CA 92501",         ssn: "553-18-9244" },
  { name: "Aisha Patel",          birthday: new Date("1990-07-09"), address: "88 Harbor View Dr, Portland, OR 97201",       ssn: "671-42-3058" },
  { name: "Robert Chen",          birthday: new Date("1968-01-22"), address: "315 Oak Park Blvd, Austin, TX 78701",         ssn: "229-67-4410" },
  { name: "Fatima Al-Rashid",     birthday: new Date("1995-12-03"), address: "2200 Birch Lane, Denver, CO 80202",           ssn: "780-33-5162" },
  { name: "Thomas O'Brien",       birthday: new Date("1958-06-17"), address: "47 Chestnut Ct, Boston, MA 02108",            ssn: "118-74-6293" },
  { name: "Sofia Ramirez",        birthday: new Date("1983-09-30"), address: "901 Willow Creek Rd, Charlotte, NC 28202",    ssn: "345-81-0027" },
  { name: "Daniel Kim",           birthday: new Date("2001-04-11"), address: "156 Pine Ridge Way, Seattle, WA 98101",       ssn: "498-26-7735" },
  { name: "Eleanor Voss",         birthday: new Date("1947-08-05"), address: "3340 Magnolia Dr, Savannah, GA 31401",        ssn: "062-59-8841" },
  { name: "Marcus Johnson",       birthday: new Date("1979-02-19"), address: "78 Cedar Springs Ln, Nashville, TN 37201",    ssn: "837-40-1156" },
  { name: "Yuki Tanaka",          birthday: new Date("1993-10-25"), address: "420 Lakeshore Blvd, Chicago, IL 60601",       ssn: "504-12-9683" },
  { name: "Catherine Mitchell",   birthday: new Date("1965-05-08"), address: "1105 Dogwood Terrace, Raleigh, NC 27601",     ssn: "261-88-3574" },
];

const seedPhysicians = [
  { license: "MD-2019-04821", name: "Dr. Priya Krishnamurthy", graduationDate: new Date("2018-05-20"), specializations: "Cardiology, Internal Medicine" },
  { license: "MD-2015-11093", name: "Dr. William Hartley",     graduationDate: new Date("2014-06-15"), specializations: "Orthopedic Surgery" },
  { license: "MD-2021-07254", name: "Dr. Amara Osei",          graduationDate: new Date("2020-05-18"), specializations: "Pediatrics" },
  { license: "MD-2012-03387", name: "Dr. Elena Volkov",        graduationDate: new Date("2011-06-10"), specializations: "Dermatology, Cosmetic Surgery" },
  { license: "MD-2017-09640", name: "Dr. Samuel Reeves",       graduationDate: new Date("2016-05-22"), specializations: "Family Medicine" },
  { license: "MD-2020-05518", name: "Dr. Mei-Lin Chang",       graduationDate: new Date("2019-06-08"), specializations: "Neurology, Sleep Medicine" },
];

function futureDate(daysFromNow: number, hour: number, minute: number = 0): Date {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  d.setHours(hour, minute, 0, 0);
  return d;
}

const seedAppointments = [
  { patientIdx: 0, physicianIdx: 0, startDay: 1, startHour: 9,  startMin: 0,  endHour: 9,  endMin: 30 },
  { patientIdx: 1, physicianIdx: 1, startDay: 1, startHour: 10, startMin: 0,  endHour: 10, endMin: 45 },
  { patientIdx: 2, physicianIdx: 2, startDay: 1, startHour: 11, startMin: 15, endHour: 11, endMin: 45 },
  { patientIdx: 3, physicianIdx: 4, startDay: 2, startHour: 8,  startMin: 30, endHour: 9,  endMin: 0  },
  { patientIdx: 4, physicianIdx: 5, startDay: 2, startHour: 13, startMin: 0,  endHour: 13, endMin: 30 },
  { patientIdx: 5, physicianIdx: 0, startDay: 2, startHour: 14, startMin: 0,  endHour: 14, endMin: 30 },
  { patientIdx: 6, physicianIdx: 3, startDay: 3, startHour: 9,  startMin: 0,  endHour: 9,  endMin: 30 },
  { patientIdx: 7, physicianIdx: 2, startDay: 3, startHour: 10, startMin: 30, endHour: 11, endMin: 0  },
  { patientIdx: 8, physicianIdx: 4, startDay: 4, startHour: 11, startMin: 0,  endHour: 11, endMin: 45 },
  { patientIdx: 9, physicianIdx: 1, startDay: 4, startHour: 15, startMin: 0,  endHour: 15, endMin: 30 },
  { patientIdx: 10, physicianIdx: 5, startDay: 5, startHour: 8, startMin: 0,  endHour: 8,  endMin: 30 },
  { patientIdx: 11, physicianIdx: 3, startDay: 5, startHour: 14, startMin: 15, endHour: 15, endMin: 0 },
  { patientIdx: 0,  physicianIdx: 4, startDay: 7, startHour: 9,  startMin: 0,  endHour: 9,  endMin: 30 },
  { patientIdx: 3,  physicianIdx: 0, startDay: 7, startHour: 13, startMin: 0,  endHour: 13, endMin: 45 },
];

export default async (req: Request) => {
  if (req.method !== "POST") {
    return new Response("Send a POST request to seed the database", { status: 405 });
  }

  const [{ value: patientCount }] = await db.select({ value: count() }).from(patients);
  const [{ value: physicianCount }] = await db.select({ value: count() }).from(physicians);

  if (patientCount > 0 || physicianCount > 0) {
    return Response.json({ message: "Database already has data, skipping seed", patients: patientCount, physicians: physicianCount }, { status: 200 });
  }

  const insertedPatients = await db.insert(patients).values(seedPatients).returning();

  await db.insert(physicians).values(seedPhysicians);

  const appointmentValues = seedAppointments.map(a => ({
    startTime: futureDate(a.startDay, a.startHour, a.startMin),
    endTime: futureDate(a.startDay, a.endHour, a.endMin),
    patientId: insertedPatients[a.patientIdx].id,
    physicianLicense: seedPhysicians[a.physicianIdx].license,
  }));

  await db.insert(appointments).values(appointmentValues);

  return Response.json({
    message: "Seed data inserted successfully",
    patients: insertedPatients.length,
    physicians: seedPhysicians.length,
    appointments: appointmentValues.length,
  }, { status: 201 });
};

export const config: Config = { path: "/api/seed" };
