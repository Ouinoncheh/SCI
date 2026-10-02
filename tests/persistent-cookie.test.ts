import { expect, it, vi } from 'vitest';
import { expireCookie, setSessionCookie } from 'better-auth/cookies';

it('sets a persistent session even when an old dont-remember cookie exists', async () => {
  const setSignedCookie = vi.fn();
  const setCookie = vi.fn();
  const ctx = {
    getSignedCookie: vi.fn().mockResolvedValue('true'), setSignedCookie, setCookie,
    context: {
      secret: 'test-secret', sessionConfig: { expiresIn: 2592000 },
      options: { session: { cookieCache: { enabled: false } } },
      authCookies: {
        sessionToken: { name: 'session', attributes: { httpOnly: true, secure: true, sameSite: 'lax' } },
        dontRememberToken: { name: 'dont_remember', attributes: { httpOnly: true } },
      },
      setNewSession: vi.fn(),
    },
  };
  const typed = ctx as unknown as Parameters<typeof setSessionCookie>[0];
  expireCookie(typed, ctx.context.authCookies.dontRememberToken);
  await setSessionCookie(typed, { session: { token: 'test-token' }, user: {} } as Parameters<typeof setSessionCookie>[1], false);
  expect(setCookie).toHaveBeenCalledWith('dont_remember', '', expect.objectContaining({ maxAge: 0 }));
  expect(setSignedCookie).toHaveBeenCalledWith('session', 'test-token', 'test-secret', expect.objectContaining({ maxAge: 2592000, httpOnly: true, secure: true }));
});
