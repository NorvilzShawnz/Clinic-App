CREATE TABLE "appointments" (
	"id" serial PRIMARY KEY,
	"start_time" timestamp,
	"end_time" timestamp,
	"patient_id" integer,
	"physician_license" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "patients" (
	"id" serial PRIMARY KEY,
	"name" text NOT NULL,
	"birthday" timestamp,
	"address" text DEFAULT '' NOT NULL,
	"ssn" text DEFAULT '' NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "physicians" (
	"license" text PRIMARY KEY,
	"name" text NOT NULL,
	"graduation_date" timestamp,
	"specializations" text DEFAULT '' NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_patient_id_patients_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id");--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_physician_license_physicians_license_fkey" FOREIGN KEY ("physician_license") REFERENCES "physicians"("license");