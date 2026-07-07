/**
 * ixcNormalize.js
 * Funções de normalização para dados brutos do IXCSoft.
 * Isola o frontend de mudanças na estrutura da API do IXC.
 */

const fmtDate = (d) => (d ? new Date(d).toLocaleDateString("pt-BR") : "—");
const fmtBRL  = (v) => Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const fmtPhone = (v) => v?.replace(/\D/g, "") || "";

// ─── Cliente ─────────────────────────────────────────────────────────────────
export function normalizeClienteIXC(raw = {}, cidadesMapa = {}) {
  return {
    id:              raw.id ?? "",
    name:            raw.razao || raw.fantasia || `Cliente #${raw.id}`,
    cpf_cnpj:        raw.cnpj_cpf ?? "",
    phone:           raw.telefone_celular || raw.fone || "",
    email:           raw.email ?? "",
    city:            cidadesMapa[String(raw.cidade)] || raw.cidade_nome || "",
    address:         [raw.endereco, raw.numero, raw.bairro].filter(Boolean).join(", "),
    active:          raw.ativo === "S",
    contract_status: raw.ativo === "S" ? "ativo" : "cancelado",
    created_at:      raw.data_cadastro ?? "",
  };
}

// ─── Contrato ─────────────────────────────────────────────────────────────────
export function normalizeContratoIXC(raw = {}, cidadesMapa = {}) {
  return {
    id:           raw.id ?? "",
    client_id:    raw.id_cliente ?? "",
    client_name:  raw.razao || raw.nome_cliente || `Cliente #${raw.id_cliente}`,
    plan_name:    raw.descricao_plano || raw.plano || raw.nome_plano || "",
    plan_id:      raw.id_plano ?? "",
    vendor_name:  raw.vendedor || raw.nome_vendedor || "",
    vendor_id:    raw.id_vendedor ?? "",
    city:         cidadesMapa[String(raw.cidade || raw.id_cidade)] || raw.cidade_nome || "",
    status:       raw.status === "A" ? "ativo" : raw.status === "CA" ? "cancelado" : raw.status ?? "",
    internet_status: raw.status_internet ?? "",
    start_date:   fmtDate(raw.data_ativacao),
    end_date:     fmtDate(raw.data_vencimento_contrato || raw.data_expiracao),
    ip:           raw.ip ?? "",
    mac:          raw.mac ?? "",
    download:     raw.download ?? "",
    upload:       raw.upload ?? "",
    olt:          raw.nome_olt || raw.olt || "",
    cto:          raw.nome_cto || raw.cto || "",
    latitude:     raw.latitude ?? "",
    longitude:    raw.longitude ?? "",
    address:      [raw.endereco, raw.numero, raw.bairro].filter(Boolean).join(", "),
    phone:        raw.fone_cliente || raw.telefone || "",
  };
}

// ─── Título financeiro ────────────────────────────────────────────────────────
export function normalizeTituloIXC(raw = {}, clientesById = {}) {
  const cliente   = clientesById[raw.id_cliente] || {};
  const hoje      = new Date();
  hoje.setHours(0, 0, 0, 0);
  const venc      = raw.data_vencimento ? new Date(raw.data_vencimento) : null;
  const pago      = raw.status === "P";
  const cancelado = raw.status === "CA";
  const atraso    = !pago && !cancelado && venc && venc < hoje
    ? Math.floor((hoje - venc) / 86_400_000)
    : 0;

  return {
    id:              raw.id ?? "",
    client_id:       raw.id_cliente ?? "",
    client_name:     cliente.razao || cliente.fantasia || raw.nome_cliente || `Cliente #${raw.id_cliente}`,
    phone:           cliente.telefone_celular || cliente.fone || "",
    contract_id:     raw.id_contrato ?? "",
    value:           parseFloat(raw.valor_aberto || raw.valor || 0),
    value_fmt:       fmtBRL(raw.valor_aberto || raw.valor),
    due_date:        raw.data_vencimento ?? "",
    due_date_fmt:    fmtDate(raw.data_vencimento),
    payment_date:    raw.data_pagamento ?? "",
    payment_date_fmt: fmtDate(raw.data_pagamento),
    status:          pago ? "pago" : cancelado ? "cancelado" : atraso > 0 ? "vencido" : "aberto",
    days_late:       atraso,
    boleto:          raw.boleto ?? "",
    linha_digitavel: raw.linha_digitavel ?? "",
    pix_code:        raw.pix_qrcode || raw.pix || "",
    vendor_id:       raw.id_vendedor ?? "",
    city:            cliente.cidade_nome || "",
  };
}

// ─── Ordem de Serviço ─────────────────────────────────────────────────────────
export function normalizeOSIXC(raw = {}) {
  return {
    id:            raw.id ?? "",
    client_id:     raw.id_cliente ?? "",
    client_name:   raw.nome_cliente || raw.cliente || `Cliente #${raw.id_cliente}`,
    contract_id:   raw.id_contrato ?? "",
    subject:       raw.assunto || raw.tipo_atendimento || "",
    description:   raw.descricao || raw.observacao || "",
    solution:      raw.solucao || raw.solução || "",
    status:        raw.status ?? "",
    status_label:  statusOSLabel(raw.status),
    priority:      raw.prioridade ?? "",
    tech_id:       raw.id_tecnico ?? "",
    tech_name:     raw.nome_tecnico || raw.tecnico || "",
    open_date:     fmtDate(raw.data_abertura),
    scheduled_date: fmtDate(raw.data_atendimento || raw.data_agendamento),
    close_date:    fmtDate(raw.data_fechamento),
    city:          raw.cidade || raw.nome_cidade || "",
    address:       [raw.endereco, raw.numero, raw.bairro].filter(Boolean).join(", "),
    phone:         raw.fone_cliente || raw.telefone || "",
    latitude:      raw.latitude ?? "",
    longitude:     raw.longitude ?? "",
  };
}

function statusOSLabel(s) {
  const map = { A: "Aberta", E: "Em andamento", F: "Fechada", C: "Cancelada", AG: "Agendada" };
  return map[s] || s || "Desconhecido";
}

// ─── Plano ────────────────────────────────────────────────────────────────────
export function normalizePlanoIXC(raw = {}) {
  return {
    id:          raw.id ?? "",
    name:        raw.nome || raw.descricao || `Plano #${raw.id}`,
    download:    raw.velocidade_down || raw.download || "",
    upload:      raw.velocidade_up || raw.upload || "",
    price:       parseFloat(raw.valor || 0),
    price_fmt:   fmtBRL(raw.valor),
    active:      raw.ativo === "S",
    type:        raw.tipo_plano || raw.tecnologia || "",
    fidelity:    raw.fidelidade ?? "",
  };
}

// ─── Vendedor ─────────────────────────────────────────────────────────────────
export function normalizeVendedorIXC(raw = {}) {
  return {
    id:     raw.id ?? "",
    name:   raw.nome || raw.vendedor || `Vendedor #${raw.id}`,
    email:  raw.email ?? "",
    phone:  raw.fone || raw.telefone || "",
    active: raw.ativo === "S",
    cpf:    raw.cpf ?? "",
  };
}

// ─── Cidade ──────────────────────────────────────────────────────────────────
export function normalizeCidadeIXC(raw = {}) {
  return {
    id:    raw.id ?? "",
    name:  raw.nome || raw.cidade || raw.descricao || "",
    uf:    raw.uf_sigla || raw.sigla_uf || raw.uf || "",
    label: (() => {
      const nome = raw.nome || raw.cidade || raw.descricao || "";
      const uf   = raw.uf_sigla || raw.sigla_uf || raw.uf || "";
      return uf ? `${nome} - ${uf}` : nome;
    })(),
  };
}

// ─── Dashboard ────────────────────────────────────────────────────────────────
export function normalizeDashboardIXC(raw = {}) {
  return {
    total_clientes:        Number(raw.total_clientes || 0),
    clientes_ativos:       Number(raw.clientes_ativos || 0),
    novos_clientes_mes:    Number(raw.novos_clientes_mes || 0),
    contratos_ativos:      Number(raw.contratos_ativos || 0),
    contratos_cancelados:  Number(raw.contratos_cancelados || 0),
    inadimplencia_total:   parseFloat(raw.inadimplencia_total || 0),
    valor_vencido:         parseFloat(raw.valor_vencido || 0),
    titulos_a_vencer:      Number(raw.titulos_a_vencer || 0),
    os_abertas:            Number(raw.os_abertas || 0),
    os_finalizadas:        Number(raw.os_finalizadas || 0),
    clientes_offline:      Number(raw.clientes_offline || 0),
    clientes_sinal_ruim:   Number(raw.clientes_sinal_ruim || 0),
    receita_mensal:        parseFloat(raw.receita_mensal || 0),
    taxa_inadimplencia:    parseFloat(raw.taxa_inadimplencia || 0),
  };
}

// ─── Helpers exportados ───────────────────────────────────────────────────────
export { fmtBRL, fmtDate, fmtPhone };
