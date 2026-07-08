import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import { ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';

const Fallback = () => (
  <div className="fixed inset-0 flex items-center justify-center bg-background">
    <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" />
  </div>
);

function AccessDenied() {
  const navigate = useNavigate();
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 p-6 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
        <ShieldAlert className="h-8 w-8 text-destructive" aria-hidden="true" />
      </div>
      <div>
        <h1 className="text-xl font-semibold text-foreground">Acesso restrito</h1>
        <p className="mt-1 max-w-sm text-pretty text-sm text-muted-foreground">
          Esta area e exclusiva para administradores. Se voce acredita que isso e um engano,
          fale com o administrador da sua organizacao.
        </p>
      </div>
      <Button onClick={() => navigate('/dashboard')}>Voltar ao painel</Button>
    </div>
  );
}

// Protege rotas administrativas. `superOnly` restringe ao super admin (dono da plataforma).
export default function AdminRoute({ superOnly = false }) {
  const { isAuthenticated, isLoadingAuth, authChecked, isAdmin, isSuperAdmin } = useAuth();

  if (isLoadingAuth || !authChecked) return <Fallback />;
  if (!isAuthenticated) return <Navigate to="/login" replace />;

  const allowed = superOnly ? isSuperAdmin : isAdmin;
  if (!allowed) return <AccessDenied />;

  return <Outlet />;
}
