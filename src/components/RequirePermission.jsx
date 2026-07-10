import { Navigate, Outlet } from 'react-router-dom';
import { ShieldAlert } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';

/**
 * Gate de autorização por rota (defesa em profundidade — a barreira real é o RLS).
 *
 * Props:
 *  - adminOnly: exige role "admin".
 *  - module + action: exige permissão de módulo (ex.: module="reports").
 *  - special: exige permissão especial (ex.: "access_financial_data").
 *  - redirectTo: se definido, redireciona em vez de mostrar aviso.
 */
export default function RequirePermission({
  adminOnly = false,
  module: moduleKey,
  action = 'view',
  special,
  redirectTo,
}) {
  const { isAdmin, hasModule, hasSpecial } = useAuth();

  let allowed = true;
  if (adminOnly) allowed = isAdmin;
  else if (moduleKey) allowed = hasModule(moduleKey, action);
  else if (special) allowed = hasSpecial(special);

  if (allowed) return <Outlet />;
  if (redirectTo) return <Navigate to={redirectTo} replace />;

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-6">
      <div className="w-14 h-14 rounded-2xl bg-destructive/10 flex items-center justify-center mb-4">
        <ShieldAlert className="w-7 h-7 text-destructive" aria-hidden="true" />
      </div>
      <h2 className="text-xl font-bold text-foreground">Acesso restrito</h2>
      <p className="text-muted-foreground mt-2 max-w-sm">
        Você não tem permissão para acessar esta área. Fale com um administrador
        se precisar de acesso.
      </p>
    </div>
  );
}
