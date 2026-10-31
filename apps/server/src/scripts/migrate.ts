import { config } from '../config';
import { openDatabase } from '../db/client';
import { seedIfEmpty } from '../db/seed';

/** Applies migrations (and sample data when enabled). Run during deploys. */
const { db, close } = await openDatabase(config);
console.log('Migrations applied');
if (config.seedIfEmpty && (await seedIfEmpty(db))) console.log('Seeded sample data');
await close();
