import { betterAuth } from 'better-auth';
import { createAuthMiddleware } from 'better-auth/api';
import { expireCookie, setSessionCookie } from 'better-auth/cookies';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { db } from './db';
import { sendMail } from './mail';
import { googleCredentials } from './google-auth';
// Lazy initialization lets the public demo build without database credentials.
let instance: ReturnType<typeof createAuth> | undefined;
export function getAuth() {
  return (instance ??= createAuth());
}
function createAuth() {
  const google = googleCredentials();
  if (
    !process.env.BETTER_AUTH_SECRET ||
    process.env.BETTER_AUTH_SECRET.length < 32 ||
    !process.env.BETTER_AUTH_URL
  )
    throw new Error('Configuration de l’authentification manquante.');
  if (
    process.env.NODE_ENV === 'production' &&
    (!process.env.BETTER_AUTH_URL.startsWith('https://') ||
      !(process.env.MAIL_MODE === 'resend' ? process.env.RESEND_API_KEY : process.env.SMTP_URL) ||
      !process.env.MAIL_FROM)
  )
    throw new Error('HTTPS et un fournisseur d’emails sont requis en production.');
  return betterAuth({
    appName: 'PredictSCI',
    baseURL: process.env.BETTER_AUTH_URL,
    secret: process.env.BETTER_AUTH_SECRET,
    trustedOrigins: [new URL(process.env.BETTER_AUTH_URL).origin],
    database: prismaAdapter(db, { provider: 'postgresql', transaction: true }),
    socialProviders: google ? { google: { ...google, prompt: 'select_account' } } : {},
    hooks: {
      after: createAuthMiddleware(async (ctx) => {
        const session = ctx.context.newSession;
        if (!session) return;
        // Clear the legacy browser-session preference, including OAuth callbacks.
        expireCookie(ctx, ctx.context.authCookies.dontRememberToken);
        await setSessionCookie(ctx, session, false);
      }),
    },
    session: {
      modelName: 'AuthSession',
      expiresIn: 60 * 60 * 24 * 30,
      updateAge: 60 * 60 * 24,
      cookieCache: { enabled: false },
    },
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 12,
      maxPasswordLength: 128,
      requireEmailVerification: true,
      autoSignIn: false,
      revokeSessionsOnPasswordReset: true,
      sendResetPassword: async ({ user, url }) => {
        await sendMail(user.email, 'Réinitialiser votre mot de passe PredictSCI', url);
      },
    },
    emailVerification: {
      sendOnSignUp: true,
      autoSignInAfterVerification: false,
      expiresIn: 3600,
      sendVerificationEmail: async ({ user, url }) => {
        await sendMail(user.email, 'Vérifier votre adresse PredictSCI', url);
      },
    },
    rateLimit: {
      enabled: true,
      storage: 'database',
      window: 60,
      max: 60,
      customRules: {
        '/sign-in/email': { window: 60, max: 10 },
        '/sign-up/email': { window: 60, max: 5 },
        '/request-password-reset': { window: 60, max: 3 },
      },
    },
    advanced: {
      defaultCookieAttributes: {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.BETTER_AUTH_URL.startsWith('https://'),
      },
    },
  });
}
