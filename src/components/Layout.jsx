import React, { useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { Search, Bell, Menu, Moon, Sun } from "lucide-react";
import Sidebar from "./Sidebar";

const pageTitles = {
  "/dashboard": "Dashboard",
  "/inbox": "Caixa de Entrada",
  "/crm": "CRM Comercial",
  "/customers": "Clientes",
  "/charges": "Cobranças",
  "/campaigns": "Campanhas WhatsApp",
  "/chatbot": "Chatbot e IA",
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

  const title = pageTitles[location.pathname] || "Atendimento 360 ISP";

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

          <div className="flex-1 max-w-md mx-auto">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Buscar clientes, conversas, protocolos..."
                className="w-full h-10 pl-10 pr-4 bg-muted/60 rounded-lg text-sm border border-transparent focus:border-primary focus:bg-card focus:outline-none transition-colors"
              />
            </div>
          </div>

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

            <div className="flex items-center gap-3 pl-3 border-l border-border">
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center text-white font-bold text-sm">
                OP
              </div>
              <div className="hidden sm:block">
                <p className="text-sm font-semibold leading-tight">Operador WOOW</p>
                <p className="text-xs text-muted-foreground">Atendente</p>
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-hidden">
          <Outlet />
        </main>
      </div>
    </div>
  );
}