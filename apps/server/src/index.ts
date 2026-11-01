import { buildApp } from './app';
import { authOptions, config } from './config';
import { openDatabase } from './db/client';
import { seedIfEmpty } from './db/seed';
import { lockDueDates } from './services/locking';

const LOCK_CHECK_INTERVAL_MS = 60_000;

const { db, close } = await openDatabase(config);
const app = await buildApp({
  db,
  now: () => new Date(),
  ...authOptions(),
  logger: true,
});

if (config.seedIfEmpty && (await seedIfEmpty(db))) app.log.info('Seeded sample data');

/** Locks orders once their cutoff passes. Each date is locked at most once, so overlapping runs are harmless. */
async function runLockJob() {
  try {
    for (const result of await lockDueDates(db, new Date())) app.log.info({ lock: result }, 'Locked orders');
  } catch (error) {
    app.log.error(error, 'Locking orders failed');
  }
}
await runLockJob();
const timer = setInterval(runLockJob, LOCK_CHECK_INTERVAL_MS);

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, async () => {
    clearInterval(timer);
    await app.close();
    await close();
    process.exit(0);
  });
}

await app.listen({ port: config.port, host: config.host });
