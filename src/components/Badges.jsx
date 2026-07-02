import React from "react";
import { cn } from "@/utils";

const channelConfig = {
  whatsapp: { label: "WhatsApp", color: "bg-green-100 text-green-700" },
  instagram: { label: "Instagram", color: "bg-pink-100 text-pink-700" },
  facebook: { label: "Messenger", color: "bg-blue-100 text-blue-700" },
  telegram: { label: "Telegram", color: "bg-sky-100 text-sky-700" },
  webchat: { label: "WebChat", color: "bg-purple-100 text-purple-700" },
  email: { label: "E-mail", color: "bg-orange-100 text-orange-700" },
  sms: { label: "SMS", color: "bg-gray-100 text-gray-700" },
  telefone: { label: "Telefone", color: "bg-indigo-100 text-indigo-700" },
  manual: { label: "Manual", color: "bg-stone-100 text-stone-700" },
};

export function ChannelBadge({ channel }) {
  const config = channelConfig[channel] || channelConfig.manual;
  return (
    <span className={cn("inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium", config.color)}>
      {config.label}
    </span>
  );
}

const statusConfig = {
  novo: { label: "Novo", color: "bg-blue-100 text-blue-700" },
  aguardando_atendimento: { label: "Aguardando", color: "bg-amber-100 text-amber-700" },
  em_atendimento: { label: "Em Atendimento", color: "bg-indigo-100 text-indigo-700" },
  aguardando_cliente: { label: "Aguardando Cliente", color: "bg-orange-100 text-orange-700" },
  aguardando_setor: { label: "Aguardando Setor", color: "bg-purple-100 text-purple-700" },
  resolvido: { label: "Resolvido", color: "bg-green-100 text-green-700" },
  finalizado: { label: "Finalizado", color: "bg-gray-100 text-gray-700" },
  perdido: { label: "Perdido", color: "bg-red-100 text-red-700" },
  reaberto: { label: "Reaberto", color: "bg-rose-100 text-rose-700" },
};

export function StatusBadge({ status }) {
  const config = statusConfig[status] || statusConfig.novo;
  return (
    <span className={cn("inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium", config.color)}>
      {config.label}
    </span>
  );
}

const priorityConfig = {
  baixa: "bg-gray-100 text-gray-600",
  media: "bg-blue-100 text-blue-600",
  alta: "bg-orange-100 text-orange-600",
  urgente: "bg-red-100 text-red-600",
};

export function PriorityBadge({ priority }) {
  return (
    <span className={cn("inline-flex items-center px-2 py-0.5 rounded text-xs font-medium", priorityConfig[priority] || priorityConfig.media)}>
      {priority}
    </span>
  );
}

const financialConfig = {
  em_dia: { label: "Em Dia", color: "bg-green-100 text-green-700" },
  pendente: { label: "Pendente", color: "bg-amber-100 text-amber-700" },
  inadimplente: { label: "Inadimplente", color: "bg-red-100 text-red-700" },
  negociando: { label: "Negociando", color: "bg-purple-100 text-purple-700" },
};

export function FinancialBadge({ status }) {
  const config = financialConfig[status] || financialConfig.em_dia;
  return (
    <span className={cn("inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium", config.color)}>
      {config.label}
    </span>
  );
}