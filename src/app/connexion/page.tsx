import { AuthForm } from '@/ui/auth-form';
export default function Login() {
  return (
    <AuthForm
      mode="login"
      localMail={process.env.MAIL_MODE === 'local' && process.env.NODE_ENV !== 'production'}
    />
  );
}
