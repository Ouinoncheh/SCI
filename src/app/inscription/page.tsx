import { AuthForm } from '@/ui/auth-form';
export default function Signup() {
  return (
    <AuthForm
      mode="register"
      localMail={process.env.MAIL_MODE === 'local' && process.env.NODE_ENV !== 'production'}
    />
  );
}
