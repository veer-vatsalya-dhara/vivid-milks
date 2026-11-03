// Builds the Vercel deployment using the Build Output API (https://vercel.com/docs/build-output-api):
//   /            the mobile app's web build (static files, single-page app)
//   /api/*       the API server as one Node.js function
// Also migrates (and, if SEED_IF_EMPTY=true, seeds) the database at DATABASE_URL.
import { execSync } from 'node:child_process';
import { cpSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { build } from 'esbuild';

const root = process.cwd();
const out = join(root, '.vercel/output');
const run = (cmd, cwd = root) => execSync(cmd, { cwd, stdio: 'inherit', env: { ...process.env, CI: '1' } });

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is not set. Connect a Postgres database to the Vercel project first.');
}

console.log('→ Migrating database');
run('npm run db:migrate -w @vivid-milks/server');

console.log('→ Building web app');
const webDist = join(root, 'apps/mobile/dist');
rmSync(webDist, { recursive: true, force: true });
run('npx expo export --platform web --output-dir dist', join(root, 'apps/mobile'));

console.log('→ Bundling API function');
rmSync(out, { recursive: true, force: true });
const funcDir = join(out, 'functions/api.func');
mkdirSync(funcDir, { recursive: true });
await build({
  entryPoints: [join(root, 'apps/server/src/vercel.ts')],
  outfile: join(funcDir, 'server.js'),
  bundle: true,
  platform: 'node',
  target: 'node22',
  format: 'cjs',
  // PGlite is development-only; pg-native is an optional pg dependency.
  external: ['@electric-sql/pglite', 'pg-native'],
  logLevel: 'warning',
  // Only used for local migrations, which the bundle never runs.
  logOverride: { 'empty-import-meta': 'silent' },
});
writeFileSync(join(funcDir, 'index.js'), "module.exports = require('./server.js').default;\n");
writeFileSync(
  join(funcDir, '.vc-config.json'),
  JSON.stringify(
    // Singapore, next to the database (the closest Neon region to India).
    { runtime: 'nodejs22.x', handler: 'index.js', launcherType: 'Nodejs', maxDuration: 30, regions: ['sin1'] },
    null,
    2,
  ),
);

console.log('→ Writing static files and routes');
cpSync(webDist, join(out, 'static'), { recursive: true });
writeFileSync(
  join(out, 'config.json'),
  JSON.stringify(
    {
      version: 3,
      routes: [
        { src: '^/api(/.*)?$', dest: '/api' },
        // Bundles, fonts and images have a content hash in their names, so browsers can keep them for a year.
        {
          src: '^/(_expo/static|assets)/.*$',
          headers: { 'cache-control': 'public, max-age=31536000, immutable' },
          continue: true,
        },
        { handle: 'filesystem' },
        // A missing hashed file is a real 404, not the app shell (which would then be cached for a year).
        { src: '^/(_expo/static|assets)/.*$', status: 404 },
        // Single-page app: every other path loads the app shell.
        { src: '/(.*)', dest: '/index.html' },
      ],
    },
    null,
    2,
  ),
);
console.log('✓ Build output ready in .vercel/output');
