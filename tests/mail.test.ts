import { afterEach, describe, expect, it, vi } from 'vitest';
import { sendMail } from '../src/server/mail';
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});
describe('emails HTTPS', () => {
  it('transmet le lien par HTTPS sans utiliser SMTP', async () => {
    vi.stubEnv('MAIL_MODE', 'resend');
    vi.stubEnv('RESEND_API_KEY', 'fake-test-key');
    vi.stubEnv('MAIL_FROM', 'test@example.invalid');
    const fetchMock = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    await sendMail('user@example.invalid', 'Vérifier', 'https://example.invalid/verify?token=test');
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.resend.com/emails');
    expect(JSON.parse(options.body)).toMatchObject({
      to: ['user@example.invalid'],
      subject: 'Vérifier',
    });
    expect(JSON.parse(options.body).text).toContain('https://example.invalid/verify?token=test');
  });
  it('ne révèle pas les erreurs du fournisseur et ne réessaie pas automatiquement', async () => {
    vi.stubEnv('MAIL_MODE', 'resend');
    vi.stubEnv('RESEND_API_KEY', 'fake-test-key');
    vi.stubEnv('MAIL_FROM', 'test@example.invalid');
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response('private-provider-detail', { status: 403 }));
    vi.stubGlobal('fetch', fetchMock);
    await expect(
      sendMail('user@example.invalid', 'Vérifier', 'https://example.invalid'),
    ).rejects.toThrow('Envoi de l’email impossible');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
