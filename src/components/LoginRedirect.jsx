import { useEffect } from 'react';
import { useAuth } from '@/lib/AuthContext';

export default function LoginRedirect() {
  const { navigateToLogin } = useAuth();

  useEffect(() => {
    navigateToLogin();
  }, [navigateToLogin]);

  return (
    <div className="fixed inset-0 flex items-center justify-center">
      <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
    </div>
  );
}
