import {
  AlertCircle, AtSign, Bot, CheckCircle, CirclePlus, Clock3,
  Database, FileSignature, Filter, Camera, Headphones,
  Mail, MessageCircle, MessageSquare, MoreHorizontal, Paperclip,
  Phone, RefreshCw, Search, Send, ShieldCheck, Sparkles, Star, Tag, Zap,
  X, UserCheck, ArrowRightLeft, StickyNote,
} from "lucide-react";

export const channelTabs = [
  { key: "all",          label: "Todos",        icon: Headphones,     className: "text-violet-600" },
  { key: "whatsapp",     label: "WhatsApp",      icon: MessageCircle,  className: "text-green-600"  },
  { key: "telefone",     label: "PABX / URA",    icon: Phone,          className: "text-indigo-600" },
  { key: "instagram",    label: "Instagram",     icon: Camera,         className: "text-pink-600"   },
  { key: "facebook",     label: "Facebook",      icon: AtSign,         className: "text-blue-600"   },
  { key: "chat_interno", label: "Chat interno",  icon: MessageSquare,  className: "text-amber-600"  },
  { key: "chat_externo", label: "Chat externo",  icon: MessageSquare,  className: "text-purple-600" },
  { key: "telegram",     label: "Telegram",      icon: Send,           className: "text-sky-600"    },
  { key: "email",        label: "E-mail",        icon: Mail,           className: "text-orange-600" },
];

export const statusFilters = [
  { key: "all",                   label: "Todos"       },
  { key: "novo",                  label: "Novos"       },
  { key: "aguardando_atendimento",label: "Fila"        },
  { key: "em_atendimento",        label: "Atendimento" },
  { key: "aguardando_cliente",    label: "Cliente"     },
  { key: "resolvido",             label: "Resolvidos"  },
];

export const integrations = [
  { service: "evolution_api",  label: "Evolution Go", icon: MessageCircle, actionLabel: "Sincronizar WhatsApp" },
  { service: "ixc_provedor",   label: "IXC",          icon: Database,      actionLabel: "Consultar cliente"    },
  { service: "validacadastro", label: "Serasa",        icon: ShieldCheck,   actionLabel: "Validar CPF/CNPJ"    },
  { service: "zapsign",        label: "ZapSign",       icon: FileSignature, actionLabel: "Checar assinatura"   },
];

export const defaultForm = {
  customer_name: "", phone: "", channel: "whatsapp",
  status: "novo", priority: "media", sector: "Atendimento",
};

export const statusTone = {
  connected:    "bg-emerald-100 text-emerald-700",
  pending:      "bg-amber-100  text-amber-700",
  error:        "bg-red-100    text-red-700",
  disconnected: "bg-muted      text-muted-foreground",
};

export function initials(name = "") {
  return name.split(" ").filter(Boolean).slice(0, 2)
    .map((p) => p[0]).join("").toUpperCase() || "?";
}

export function formatTime(value) {
  if (!value) return "";
  return new Date(value).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

export function formatDate(value) {
  if (!value) return "";
  return new Date(value).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}

export function statusLabel(s) {
  return { connected: "Conectado", pending: "Pendente", error: "Erro", disconnected: "Pendente" }[s] || "Pendente";
}

export function sameMsg(a, b) {
  if (!a || !b) return false;
  if (a.id && b.id && a.id === b.id) return true;
  if (a.wa_message_id && b.wa_message_id && a.wa_message_id === b.wa_message_id) return true;
  if (a.provider_message_id && b.provider_message_id && a.provider_message_id === b.provider_message_id) return true;
  return false;
}

export const rightTabs = [
  { key: "dados",     label: "Dados"     },
  { key: "ixc",       label: "IXC"       },
  { key: "historico", label: "Histórico" },
  { key: "acordo",    label: "Acordo"    },
  { key: "modelos",   label: "Modelos"   },
  { key: "contratos", label: "Contratos" },
];