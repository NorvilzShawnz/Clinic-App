import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    // Tests write times in UTC; clinic.test.ts covers other zones by passing them explicitly.
    env: { CLINIC_TIME_ZONE: "UTC" },
  },
});
