import { pgTable, serial, text, timestamp, integer } from "drizzle-orm/pg-core";

export const patients = pgTable("patients", {
  id: serial().primaryKey(),
  name: text().notNull(),
  birthday: timestamp("birthday"),
  address: text().notNull().default(""),
  ssn: text().notNull().default(""),
  createdAt: timestamp("created_at").defaultNow(),
});

export const physicians = pgTable("physicians", {
  license: text().primaryKey(),
  name: text().notNull(),
  graduationDate: timestamp("graduation_date"),
  specializations: text().notNull().default(""),
  createdAt: timestamp("created_at").defaultNow(),
});

export const appointments = pgTable("appointments", {
  id: serial().primaryKey(),
  startTime: timestamp("start_time"),
  endTime: timestamp("end_time"),
  patientId: integer("patient_id").references(() => patients.id),
  physicianLicense: text("physician_license").references(() => physicians.license),
  createdAt: timestamp("created_at").defaultNow(),
});
