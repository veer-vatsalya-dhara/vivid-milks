import { config } from '../config';
import { openDatabase } from '../db/client';
import { removeSampleData } from '../db/remove-sample-data';

/**
 * Removes the sample data from the database in DATABASE_URL (or the local PGlite database).
 * Shows what would be removed; pass --apply to remove it.
 */
const apply = process.argv.includes('--apply');
const { db, close } = await openDatabase({ ...config, migrate: false });
try {
  const report = await removeSampleData(db, { apply });
  const line = (label: string, items: string[]) => console.log(`${label}: ${items.length ? items.join(', ') : 'none'}`);
  console.log(apply ? 'Removed sample data:' : 'Would remove (dry run, nothing changed):');
  line('  People', report.users);
  line('  Products', report.products);
  line('  Routes', report.routes);
  line('  Buildings', report.buildings);
  console.log(`  Deliveries: ${report.deliveries}`);
  console.log(`  Wallet entries: ${report.walletTxns}`);
  line('  Unlocked future days', report.unlockedDates);
  if (report.productsKept.length) line('Kept (used by real customers) products', report.productsKept);
  if (report.routesKept.length) line('Kept (real customers on it) routes', report.routesKept);
  if (!apply) console.log('\nRun again with --apply to remove it.');
} finally {
  await close();
}
