import React, { useState } from "react";
import { Outlet, useLocation, useNavigate, Link } from "react-router-dom";
import { Bell, Menu, Moon, Sun, LogOut, Settings as SettingsIcon, ShieldCheck, User as UserIcon } from "lucide-react";
import Sidebar from "./Sidebar";
import GlobalSearch from "./layout/GlobalSearch";
import { useAuth } from "@/lib/AuthContext";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const roleLabels = {
  super_admin: "Super Admin",
  admin: "Administrador",
  agent: "Atendente",
};

function initialsOf(name = "", email = "") {
  const base = (name || email || "").trim();
  if (!base) return "US";
  const parts = base.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

const pageTitles = {
  "/dashboard": "Dashboard",
  "/inbox": "Caixa de Entrada",
  "/crm": "CRM Comercial",
  "/customers": "Clientes",
  "/charges": "Cobranças",
  "/campaigns": "Campanhas WhatsApp",
  "/chatbot": "Chatbot e IA",
  "/message-templates": "Templates de Mensagem",
  "/signatures": "Assinatura Eletrônica",
  "/knowledge": "Base de Conhecimento",
  "/reports": "Relatórios",
  "/integrations": "Integrações",
  "/settings": "Configurações",
};

export default function Layout() {
  const [collapsed, setCollapsed] = useState(false);
  const [dark, setDark] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { user, isAdmin, isSuperAdmin, logout } = useAuth();

  const title = pageTitles[location.pathname] || "Atendimento 360 ISP";

  const displayName = user?.full_name || user?.email || "Usuario";
  const roleLabel = roleLabels[user?.role] || "Atendente";
  const initials = initialsOf(user?.full_name, user?.email);

  const handleLogout = async () => {
    await logout();
    navigate("/login", { replace: true });
  };

  return (
    <div className={`flex h-screen overflow-hidden ${dark ? "dark" : ""}`}>
      <Sidebar collapsed={collapsed} setCollapsed={setCollapsed} />

      <div className="flex-1 flex flex-col bg-background">
        <header className="h-16 border-b border-border bg-card flex items-center gap-4 px-6 flex-shrink-0">
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="lg:hidden p-2 hover:bg-muted rounded-lg"
          >
            <Menu className="w-5 h-5" />
          </button>

          <h1 className="text-lg font-bold font-heading hidden sm:block text-foreground">{title}</h1>

          <GlobalSearch />

          <div className="flex items-center gap-2">
            <button
              onClick={() => setDark(!dark)}
              className="p-2.5 hover:bg-muted rounded-lg transition-colors"
              title="Alternar tema"
            >
              {dark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>

            <button className="relative p-2.5 hover:bg-muted rounded-lg transition-colors">
              <Bell className="w-5 h-5" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-destructive rounded-full" />
            </button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-3 pl-3 border-l border-border rounded-lg hover:bg-muted/60 transition-colors py-1 pr-2">
                  <div className="w-9 h-9 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-bold text-sm">
                    {initials}
                  </div>
                  <div className="hidden sm:block text-left">
                    <p className="text-sm font-semibold leading-tight text-foreground">{displayName}</p>
                    <p className="text-xs text-muted-foreground">{roleLabel}</p>
                  </div>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>
                  <p className="text-sm font-medium text-foreground truncate">{displayName}</p>
                  <p className="text-xs font-normal text-muted-foreground truncate">{user?.email}</p>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link to="/settings" className="cursor-pointer">
                    <UserIcon className="w-4 h-4 mr-2" aria-hidden="true" />
                    Meu perfil
                  </Link>
                </DropdownMenuItem>
                {isAdmin && (
                  <DropdownMenuItem asChild>
                    <Link to="/settings" className="cursor-pointer">
                      <SettingsIcon className="w-4 h-4 mr-2" aria-hidden="true" />
                      Configuracoes
                    </Link>
                  </DropdownMenuItem>
                )}
                {isSuperAdmin && (
                  <DropdownMenuItem asChild>
                    <Link to="/platform/organizations" className="cursor-pointer">
                      <ShieldCheck className="w-4 h-4 mr-2" aria-hidden="true" />
                      Area da plataforma
                    </Link>
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout} className="cursor-pointer text-destructive focus:text-destructive">
                  <LogOut className="w-4 h-4 mr-2" aria-hidden="true" />
                  Sair
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        <main className="flex-1 overflow-hidden">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
