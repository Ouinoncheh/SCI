import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
const start = (overrides: Record<string, string>) =>
  spawnSync(process.execPath, ['scripts/start-production.mjs'], {
    encoding: 'utf8',
    timeout: 5000,
    env: {
      ...process.env,
      DATABASE_URL: '',
      BETTER_AUTH_URL: '',
      BETTER_AUTH_SECRET: '',
      SMTP_URL: '',
      MAIL_FROM: '',
      MAIL_MODE: '',
      ...overrides,
    },
  });
describe('démarrage de production', () => {
  it('refuse une configuration incomplète avant de lancer le serveur', () => {
    const result = start({});
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('Configuration de production invalide');
    expect(result.stderr).toContain('DATABASE_URL manquant');
  });
  it('refuse HTTP et les emails locaux sans exposer les secrets', () => {
    const secret = 'private-test-only-secret-never-display';
    const result = start({
      DATABASE_URL: 'postgresql://user:private-password@db.example.invalid/db',
      BETTER_AUTH_URL: 'http://example.invalid',
      BETTER_AUTH_SECRET: secret,
      SMTP_URL: 'smtp://user:private-password@mail.example.invalid',
      MAIL_FROM: 'test@example.invalid',
      MAIL_MODE: 'local',
    });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('BETTER_AUTH_URL : protocole invalide');
    expect(result.stderr).toContain('MAIL_MODE=local interdit');
    expect(result.stderr).not.toContain(secret);
    expect(result.stderr).not.toContain('private-password');
  });
});
