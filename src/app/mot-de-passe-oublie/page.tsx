import { AuthForm } from '@/ui/auth-form';
export default function Forgot() {
  return (
    <AuthForm
      mode="forgot"
      localMail={process.env.MAIL_MODE === 'local' && process.env.NODE_ENV !== 'production'}
    />
  );
}
