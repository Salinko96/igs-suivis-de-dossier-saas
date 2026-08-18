import { count } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { dossiers, referenceItems } from "../drizzle/schema";
import { calculateDossierState } from "./dossierRules";
import { initialImportData } from "./initialImportData";
import { ENV } from "./_core/env";

const fromSourceDate = (value?: string | null) => value ? new Date(`${value}T00:00:00.000Z`) : null;

async function seed() {
  const databaseUrl = process.env.DATABASE_URL || ENV.databaseUrl;
  if (!databaseUrl) {
    console.error("❌ DATABASE_URL is not defined in environment variables.");
    process.exit(1);
  }

  console.log("🌱 Connecting to database...");
  const client = postgres(databaseUrl, { max: 10, idle_timeout: 20 });
  const db = drizzle(client);

  try {
    // Seed Reference Items
    const [refCount] = await db.select({ value: count() }).from(referenceItems);
    if ((refCount?.value ?? 0) === 0) {
      console.log(`📦 Inserting ${initialImportData.referenceItems.length} reference items...`);
      await db.insert(referenceItems).values(Array.from(initialImportData.referenceItems));
      console.log("✅ Reference items seeded.");
    } else {
      console.log("ℹ️ Reference items already exist. Skipping.");
    }

    // Seed Dossiers
    const [dossierCount] = await db.select({ value: count() }).from(dossiers);
    if ((dossierCount?.value ?? 0) === 0) {
      console.log(`📦 Inserting ${initialImportData.dossiers.length} dossiers...`);
      const batch = initialImportData.dossiers.map(source => {
        const payload = {
          ...source,
          eta: fromSourceDate(source.eta),
          goodsReleaseDate: fromSourceDate(source.goodsReleaseDate),
        };
        const state = calculateDossierState(payload);
        return { ...payload, ...state, missingFields: undefined };
      });
      await db.insert(dossiers).values(batch.map(({ missingFields: _ignored, ...record }) => record));
      console.log("✅ Dossiers seeded.");
    } else {
      console.log("ℹ️ Dossiers already exist. Skipping.");
    }

    console.log("🎉 Database seeding completed successfully!");
  } catch (error) {
    console.error("❌ Seeding failed:", error);
    process.exit(1);
  } finally {
    await client.end();
    process.exit(0);
  }
}

seed();
