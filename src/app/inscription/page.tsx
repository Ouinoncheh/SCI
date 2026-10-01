import { AuthForm } from '@/ui/auth-form';
import { googleCredentials } from '@/server/google-auth';
export const dynamic = 'force-dynamic';
export default async function Signup({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;
  return (
    <AuthForm
      mode="register"
      googleEnabled={Boolean(googleCredentials())}
      googleError={params.error !== undefined}
      localMail={process.env.MAIL_MODE === 'local' && process.env.NODE_ENV !== 'production'}
    />
  );
}
