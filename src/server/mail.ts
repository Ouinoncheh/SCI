import { mkdir, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import nodemailer from 'nodemailer';
export async function sendMail(to: string, subject: string, url: string) {
  const text = `${subject}\n\n${url}\n\nSi vous n’êtes pas à l’origine de cette demande, ignorez ce message.`;
  if (process.env.MAIL_MODE === 'resend') {
    if (!process.env.RESEND_API_KEY || !process.env.MAIL_FROM)
      throw new Error('Configuration des emails manquante.');
    try {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        redirect: 'error',
        signal: AbortSignal.timeout(15000),
        headers: {
          Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ from: process.env.MAIL_FROM, to: [to], subject, text }),
      });
      if (!response.ok) throw new Error('Envoi impossible.');
    } catch {
      throw new Error('Envoi de l’email impossible. Réessayez ultérieurement.');
    }
    return;
  }
  if (process.env.MAIL_MODE === 'local' && process.env.NODE_ENV !== 'production') {
    const dir = path.join(process.cwd(), '.local', 'mail');
    await mkdir(dir, { recursive: true });
    await writeFile(
      path.join(dir, `${Date.now()}-${randomUUID()}.json`),
      JSON.stringify({ to, subject, url, createdAt: new Date().toISOString() }, null, 2),
      { mode: 0o600 },
    );
    return;
  }
  if (!process.env.SMTP_URL || !process.env.MAIL_FROM)
    throw new Error('SMTP_URL et MAIL_FROM requis pour les emails.');
  await nodemailer.createTransport(process.env.SMTP_URL).sendMail({
    from: process.env.MAIL_FROM,
    to,
    subject,
    text,
  });
}
