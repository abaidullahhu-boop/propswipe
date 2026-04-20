import { defineConfig } from "drizzle-kit";

if (!process.env.DATABASE_URL) {
  console.log("No DATABASE_URL provided. Skipping database operations.");
  process.exit(0);
}

export default defineConfig({
  out: "./migrations",
  schema: "./shared/schema.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
});
