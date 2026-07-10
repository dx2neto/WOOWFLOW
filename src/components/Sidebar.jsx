import React, { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import {
  LayoutDashboard, Inbox, Users, DollarSign,
  Send, Bot, FileSignature, BarChart3, BookOpen, Plug, Settings,
  ChevronLeft, UserCog, Tags, ScrollText, CalendarDays, PhoneCall,
  AlertTriangle, MessageSquareText, Workflow, Bot as BotIcon,
  FileText, Wifi, TrendingDown, Wrench, WifiOff, ShoppingBag, TestTube2,
  Shield, History
} from "lucide-react";

// ── Hook: contagem de conversas não lidas em tempo real ───────────────────────
function useUnreadCount() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    // Carga inicial
    base44.entities.Conversation.filter({ unread: true })
      .then((data) => setCount(data.length))
      .catch(() => setCount(0));

    // Realtime
    const unsub = base44.entities.Conversation.subscribe((event) => {
      setCount((prev) => {
        if (event.type === "create") return event.data.unread ? prev + 1 : prev;
        if (event.type === "update") {
          // Re-consulta para garantir precisão — leve, pois é apenas a contagem
          base44.entities.Conversation.filter({ unread: true })
            .then((data) => setCount(data.length))
            .catch(() => {});
          return prev;
        }
        if (event.type === "delete") return event.data.unread ? Math.max(0, prev - 1) : prev;
        return prev;
      });
    });
    return unsub;
  }, []);

  return count;
}

// ── Menu estático ─────────────────────────────────────────────────────────────
const menuGroups = [
  {
    label: "Atendimento",
    items: [
      { label: "Dashboard",           path: "/dashboard",       icon: LayoutDashboard },
      { label: "Caixa de Entrada",    path: "/inbox",           icon: Inbox, badgeKey: "inbox" },
      { label: "CRM",                 path: "/crm",             icon: Users },
      { label: "Automações do CRM",   path: "/crm-automations", icon: Workflow },
      { label: "Campanhas",           path: "/campaigns",       icon: Send },
      { label: "Chatbot / IA",        path: "/chatbot",         icon: Bot },
      { label: "Painel da Lara",      path: "/lara-dashboard",  icon: BotIcon },
      { label: "Logs da Lara",        path: "/lara-logs",       icon: BotIcon },
      { label: "Relatórios da Lara",  path: "/lara-reports",    icon: BarChart3 },
    ],
  },
  {
    label: "IXCSoft — Provedor",
    items: [
      { label: "Clientes",                   path: "/customers",   icon: Users },
      { label: "Contratos",                  path: "/contracts",   icon: FileText },
      { label: "Planos",                     path: "/plans",       icon: Wifi },
      { label: "Vendedores",                 path: "/vendors",     icon: ShoppingBag },
      { label: "Cobranças",                  path: "/charges",     icon: DollarSign },
      { label: "Financeiro / Inadimplência", path: "/financial",   icon: TrendingDown },
      { label: "Verificação de Acordo",      path: "/agreements",  icon: Shield },
      { label: "Ordens de Serviço",          path: "/work-orders", icon: Wrench },
      { label: "NOC",                        path: "/noc",         icon: WifiOff },
      { label: "Teste IXCSoft",              path: "/ixc-test",    icon: TestTube2 },
    ],
  },
  {
    label: "Ferramentas",
    items: [
      { label: "Templates de Mensagem",   path: "/message-templates", icon: MessageSquareText },
      { label: "Assinatura de Contratos", path: "/signatures",        icon: FileSignature },
      { label: "Base de Conhecimento",    path: "/knowledge",         icon: BookOpen },
      { label: "Relatórios",              path: "/reports",           icon: BarChart3 },
      { label: "Integrações",             path: "/integrations",      icon: Plug },
      { label: "Telefonia Omnichannel",   path: "/telephony",         icon: PhoneCall },
    ],
  },
  {
    label: "Configurações",
    items: [
      { label: "Usuários",           path: "/users",               icon: UserCog },
      { label: "Etiquetas e Filas",  path: "/tags-queues",         icon: Tags },
      { label: "Feriados e Horários",path: "/holidays",            icon: CalendarDays },
      { label: "Logs de Auditoria",  path: "/audit-logs",          icon: ScrollText },
      { label: "Logs do Sistema",    path: "/system-logs",         icon: AlertTriangle },
      { label: "Logs Sync WhatsApp", path: "/evolution-sync-logs", icon: History },
      { label: "Configurações",      path: "/settings",            icon: Settings },
    ],
  },
];

export default function Sidebar({ collapsed, setCollapsed }) {
  const location   = useLocation();
  const unreadCount = useUnreadCount();

  // Mapa de valores dinâmicos por badgeKey
  const badgeValues = { inbox: unreadCount > 0 ? unreadCount : null };

  return (
    <aside className={`${collapsed ? "w-20" : "w-64"} flex-shrink-0 bg-sidebar text-sidebar-foreground flex flex-col transition-all duration-300 border-r border-sidebar-border`}>
      {/* Logo */}
      <div className="h-16 flex items-center gap-3 px-4 border-b border-sidebar-border">
        <div className="w-10 h-10 rounded-xl bg-accent flex items-center justify-center flex-shrink-0 text-white font-black text-xs leading-none">
          <svg width="24" height="18" viewBox="0 0 24 18" fill="none">
            <path d="M2 9 C2 4.6 5.6 1 10 1"  stroke="white" strokeWidth="2.5" strokeLinecap="round" fill="none"/>
            <path d="M4.5 9 C4.5 6 6.9 3.5 10 3.5" stroke="white" strokeWidth="2.5" strokeLinecap="round" fill="none"/>
            <path d="M7 9 C7 7.3 8.3 6 10 6"  stroke="white" strokeWidth="2.5" strokeLinecap="round" fill="none"/>
            <circle cx="10" cy="9" r="1.5" fill="white"/>
          </svg>
        </div>
        {!collapsed && (
          <div className="overflow-hidden">
            <p className="font-black text-base leading-tight tracking-wide text-white">WOOW</p>
            <p className="text-xs text-accent font-semibold tracking-widest leading-tight">CHAT</p>
          </div>
        )}
      </div>

      {/* Navegação */}
      <nav className="flex-1 overflow-y-auto scrollbar-thin py-3 px-2">
        {menuGroups.map((group) => (
          <div key={group.label} className="mb-3">
            {!collapsed && (
              <p className="text-[10px] font-bold uppercase tracking-widest text-sidebar-foreground/40 px-3 mb-1">
                {group.label}
              </p>
            )}
            {group.items.map((item) => {
              const isActive  = location.pathname === item.path;
              const Icon      = item.icon;
              const badgeVal  = item.badgeKey ? badgeValues[item.badgeKey] : null;

              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg mb-0.5 text-sm font-medium transition-colors ${
                    isActive
                      ? "bg-sidebar-primary text-sidebar-primary-foreground"
                      : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                  }`}
                  title={collapsed ? item.label : undefined}
                >
                  <div className="relative flex-shrink-0">
                    <Icon className="w-5 h-5" />
                    {/* Badge compacto quando collapsed */}
                    {collapsed && badgeVal ? (
                      <span className="absolute -top-1.5 -right-1.5 h-4 w-4 flex items-center justify-center rounded-full bg-accent text-accent-foreground text-[9px] font-black">
                        {badgeVal > 99 ? "99+" : badgeVal}
                      </span>
                    ) : null}
                  </div>
                  {!collapsed && <span className="flex-1 truncate">{item.label}</span>}
                  {!collapsed && badgeVal ? (
                    <span className="bg-accent text-accent-foreground text-xs font-bold px-2 py-0.5 rounded-full flex-shrink-0">
                      {badgeVal > 99 ? "99+" : badgeVal}
                    </span>
                  ) : null}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Botão colapsar */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="h-12 flex items-center justify-center border-t border-sidebar-border text-sidebar-foreground/60 hover:text-sidebar-foreground transition-colors"
      >
        <ChevronLeft className={`w-5 h-5 transition-transform ${collapsed ? "rotate-180" : ""}`} />
      </button>
    </aside>
  );
}
