import { spawn, spawnSync } from 'node:child_process';

const required = [
  'DATABASE_URL',
  'BETTER_AUTH_URL',
  'BETTER_AUTH_SECRET',
  'MAIL_FROM',
  process.env.MAIL_MODE === 'resend' ? 'RESEND_API_KEY' : 'SMTP_URL',
];
const errors = required.filter((key) => !process.env[key]).map((key) => `${key} manquant`);
if (process.env.MEDIA_STORAGE === 'supabase') {
  for (const key of ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_STORAGE_BUCKET'])
    if (!process.env[key]) errors.push(`${key} manquant`);
}
if ((process.env.BETTER_AUTH_SECRET ?? '').length < 32)
  errors.push('BETTER_AUTH_SECRET doit contenir au moins 32 caractères');
for (const [key, protocols] of [
  ['DATABASE_URL', ['postgres:', 'postgresql:']],
  ['BETTER_AUTH_URL', ['https:']],
  ...(process.env.MAIL_MODE === 'resend' ? [] : [['SMTP_URL', ['smtp:', 'smtps:']]]),
]) {
  try {
    const url = new URL(process.env[key]);
    if (!protocols.includes(url.protocol)) errors.push(`${key} : protocole invalide`);
    if (
      key === 'BETTER_AUTH_URL' &&
      (url.username ||
        url.password ||
        url.search ||
        url.hash ||
        (url.pathname !== '/' && url.pathname !== ''))
    )
      errors.push('BETTER_AUTH_URL doit être l’origine publique HTTPS');
  } catch {
    errors.push(`${key} : URL invalide`);
  }
}
if (process.env.MAIL_MODE === 'local') errors.push('MAIL_MODE=local interdit en production');
if (errors.length) {
  console.error(`Configuration de production invalide : ${[...new Set(errors)].join('; ')}.`);
  process.exit(1);
}
process.env.NODE_ENV = 'production';
if (process.env.RUN_MIGRATIONS_ON_START === 'true') {
  const migration = spawnSync(
    process.execPath,
    ['node_modules/prisma/build/index.js', 'migrate', 'deploy'],
    { stdio: 'inherit', env: process.env, timeout: 120000 },
  );
  if (migration.status !== 0) {
    console.error('Migration impossible : démarrage annulé.');
    process.exit(1);
  }
}
const child = spawn(
  process.execPath,
  ['node_modules/next/dist/bin/next', 'start', '--hostname', '0.0.0.0'],
  { stdio: 'inherit', env: process.env },
);
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal));
child.on('error', () => {
  console.error('Démarrage impossible.');
  process.exit(1);
});
child.on('exit', (code, signal) => process.exit(code ?? (signal ? 1 : 0)));
