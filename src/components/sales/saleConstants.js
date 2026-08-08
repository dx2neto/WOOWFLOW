export const SALE_STAGES = [
  { key: "novo_lead", label: "Novo Lead", color: "bg-slate-500", text: "text-slate-600" },
  { key: "cpf_validado", label: "CPF Validado", color: "bg-blue-500", text: "text-blue-600" },
  { key: "ixc_consultado", label: "IXC Consultado", color: "bg-indigo-500", text: "text-indigo-600" },
  { key: "analise_debitos", label: "Análise de Débitos", color: "bg-amber-500", text: "text-amber-600" },
  { key: "consulta_credito", label: "Consulta de Crédito", color: "bg-purple-500", text: "text-purple-600" },
  { key: "aprovado", label: "Aprovado", color: "bg-green-500", text: "text-green-600" },
  { key: "reprovado", label: "Reprovado", color: "bg-red-500", text: "text-red-600" },
  { key: "analise_manual", label: "Análise Manual", color: "bg-orange-500", text: "text-orange-600" },
  { key: "contrato_gerado", label: "Contrato Gerado", color: "bg-cyan-500", text: "text-cyan-600" },
  { key: "assinatura_enviada", label: "Assinatura Enviada", color: "bg-teal-500", text: "text-teal-600" },
  { key: "assinado", label: "Assinado", color: "bg-emerald-500", text: "text-emerald-600" },
  { key: "ativacao", label: "Ativação", color: "bg-violet-500", text: "text-violet-600" },
  { key: "concluido", label: "Concluído", color: "bg-green-600", text: "text-green-700" },
  { key: "perdido", label: "Perdido", color: "bg-rose-600", text: "text-rose-700" },
];

export const SALE_STAGE_KEYS = SALE_STAGES.map(s => s.key);

export const KANBAN_COLUMNS = [
  { key: "novo_lead", label: "Novo Lead", color: "border-t-slate-500" },
  { key: "cpf_validado", label: "CPF Validado", color: "border-t-blue-500" },
  { key: "ixc_consultado", label: "IXC + Débitos", color: "border-t-indigo-500" },
  { key: "consulta_credito", label: "Crédito", color: "border-t-purple-500" },
  { key: "aprovado", label: "Aprovado", color: "border-t-green-500" },
  { key: "analise_manual", label: "Análise Manual", color: "border-t-orange-500" },
  { key: "contrato_gerado", label: "Contrato Gerado", color: "border-t-cyan-500" },
  { key: "assinatura_enviada", label: "Assinatura", color: "border-t-teal-500" },
  { key: "concluido", label: "Concluído", color: "border-t-green-600" },
];

export const RESELLER_STATUS = [
  { key: "ativo", label: "Ativo", color: "bg-green-100 text-green-700" },
  { key: "inativo", label: "Inativo", color: "bg-slate-100 text-slate-600" },
  { key: "pendente", label: "Pendente", color: "bg-amber-100 text-amber-700" },
  { key: "bloqueado", label: "Bloqueado", color: "bg-red-100 text-red-700" },
];

export const SALE_TYPES = [
  { key: "direta", label: "Venda Direta", color: "bg-blue-100 text-blue-700" },
  { key: "revenda", label: "Venda Revenda", color: "bg-purple-100 text-purple-700" },
];