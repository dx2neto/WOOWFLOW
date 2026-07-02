import React, { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  LayoutDashboard, Inbox, MessageSquare, Users, DollarSign,
  Send, Bot, FileSignature, BarChart3, BookOpen, Plug, Settings,
  ChevronLeft, Zap, UserCog
} from "lucide-react";

const menuItems = [
  { label: "Dashboard", path: "/dashboard", icon: LayoutDashboard },
  { label: "Caixa de Entrada", path: "/inbox", icon: Inbox, badge: 12 },
  { label: "CRM", path: "/crm", icon: Users },
  { label: "Clientes", path: "/customers", icon: Users },
  { label: "Cobranças", path: "/charges", icon: DollarSign },
  { label: "Campanhas", path: "/campaigns", icon: Send },
  { label: "Chatbot / IA", path: "/chatbot", icon: Bot },
  { label: "Assinaturas", path: "/signatures", icon: FileSignature },
  { label: "Base de Conhecimento", path: "/knowledge", icon: BookOpen },
  { label: "Relatórios", path: "/reports", icon: BarChart3 },
  { label: "Integrações", path: "/integrations", icon: Plug },
  { label: "Usuários", path: "/users", icon: UserCog },
  { label: "Configurações", path: "/settings", icon: Settings },
];

export default function Sidebar({ collapsed, setCollapsed }) {
  const location = useLocation();

  return (
    <aside className={`${collapsed ? "w-20" : "w-64"} flex-shrink-0 bg-sidebar text-sidebar-foreground flex flex-col transition-all duration-300 border-r border-sidebar-border`}>
      <div className="h-16 flex items-center gap-3 px-4 border-b border-sidebar-border">
        <div className="w-10 h-10 rounded-xl bg-accent flex items-center justify-center flex-shrink-0 text-white font-black text-xs leading-none">
          <svg width="24" height="18" viewBox="0 0 24 18" fill="none">
            <path d="M2 9 C2 4.6 5.6 1 10 1" stroke="white" strokeWidth="2.5" strokeLinecap="round" fill="none"/>
            <path d="M4.5 9 C4.5 6 6.9 3.5 10 3.5" stroke="white" strokeWidth="2.5" strokeLinecap="round" fill="none"/>
            <path d="M7 9 C7 7.3 8.3 6 10 6" stroke="white" strokeWidth="2.5" strokeLinecap="round" fill="none"/>
            <circle cx="10" cy="9" r="1.5" fill="white"/>
          </svg>
        </div>
        {!collapsed && (
          <div className="overflow-hidden">
            <p className="font-black text-base leading-tight tracking-wide text-white">WOOW</p>
            <p className="text-xs text-accent font-semibold tracking-widest leading-tight">TELECOM</p>
          </div>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto scrollbar-thin py-3 px-2">
        {menuItems.map((item) => {
          const isActive = location.pathname === item.path;
          const Icon = item.icon;
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg mb-1 text-sm font-medium transition-colors ${
                isActive
                  ? "bg-sidebar-primary text-sidebar-primary-foreground"
                  : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              }`}
              title={collapsed ? item.label : undefined}
            >
              <Icon className="w-5 h-5 flex-shrink-0" />
              {!collapsed && <span className="flex-1 truncate">{item.label}</span>}
              {!collapsed && item.badge && (
                <span className="bg-accent text-accent-foreground text-xs font-bold px-2 py-0.5 rounded-full">
                  {item.badge}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      <button
        onClick={() => setCollapsed(!collapsed)}
        className="h-12 flex items-center justify-center border-t border-sidebar-border text-sidebar-foreground/60 hover:text-sidebar-foreground transition-colors"
      >
        <ChevronLeft className={`w-5 h-5 transition-transform ${collapsed ? "rotate-180" : ""}`} />
      </button>
    </aside>
  );
}