const axios = require('axios');
const logger = require('../utils/logger');

// ─── Axios instance com Basic Auth ──────────────────────────────────────────
const ixc = axios.create({
  baseURL: process.env.IXC_BASE_URL,
  timeout: 20000,
  headers: { 'Content-Type': 'application/json' },
  auth: {
    username: process.env.IXC_USERNAME,
    password: process.env.IXC_TOKEN,
  },
});

// ─── Interceptors ────────────────────────────────────────────────────────────
ixc.interceptors.request.use((config) => {
  logger.debug(`[IXC] ${config.method?.toUpperCase()} ${config.url}`);
  return config;
});

ixc.interceptors.response.use(
  (res) => res,
  (err) => {
    const status = err.response?.status;
    const msg    = err.response?.data?.message || err.message;
    logger.error(`[IXC] ERRO ${status || 'TIMEOUT'}: ${err.config?.url} → ${msg}`);
    throw err;
  }
);

// ─── Helper: monta payload de busca IXC ─────────────────────────────────────
function query(qtype, value, oper = '=', extra = {}) {
  return {
    qtype,
    query: String(value),
    oper,
    page: '1',
    rp: '50',
    sortname: qtype,
    sortorder: 'desc',
    ...extra,
  };
}

// ════════════════════════════════════════════════════════════════════════════
//  UTIL
// ════════════════════════════════════════════════════════════════════════════
function limparTelefone(tel) {
  if (!tel) return '';
  return tel.replace(/\D/g, '');
}

function formatarMoeda(valor) {
  return parseFloat(valor || 0).toFixed(2).replace('.', ',');
}

function formatarData(dataStr) {
  if (!dataStr) return '';
  const [ano, mes, dia] = dataStr.split('-');
  return `${dia}/${mes}/${ano}`;
}

function calcularDiasAtraso(dataVencimento) {
  const venc = new Date(dataVencimento + 'T00:00:00');
  const hoje = new Date();
  return Math.max(0, Math.floor((hoje - venc) / 86400000));
}

// ════════════════════════════════════════════════════════════════════════════
//  CLIENTES
// ════════════════════════════════════════════════════════════════════════════

async function buscarClientePorId(id) {
  const { data } = await ixc.get(`/cliente/${id}`);
  return data;
}

async function buscarClientePorCpf(cpf) {
  const cpfLimpo = cpf.replace(/\D/g, '');
  const { data } = await ixc.post('/cliente', query('cliente.cnpj_cpf', cpfLimpo));
  return data?.registros?.[0] ?? null;
}

async function buscarClientePorTelefone(telefone) {
  const num = limparTelefone(telefone).replace(/^55/, '');

  // Tenta celular primeiro, depois fone_celular
  const buscas = [
    ixc.post('/cliente', query('cliente.celular', `%${num}%`, 'like')),
    ixc.post('/cliente', query('cliente.fone_celular', `%${num}%`, 'like')),
  ];

  const resultados = await Promise.allSettled(buscas);
  const clientes = [];

  for (const r of resultados) {
    if (r.status === 'fulfilled') {
      const regs = r.value.data?.registros ?? [];
      for (const c of regs) {
        if (!clientes.find((x) => x.id === c.id)) clientes.push(c);
      }
    }
  }

  return clientes;
}

async function buscarContratosCliente(clienteId) {
  const { data } = await ixc.post(
    '/cliente_contrato',
    query('cliente_contrato.id_cliente', clienteId)
  );
  return data?.registros ?? [];
}

// ════════════════════════════════════════════════════════════════════════════
//  FINANCEIRO
// ════════════════════════════════════════════════════════════════════════════

async function buscarCobrancasAbertas(clienteId) {
  const { data } = await ixc.post('/fn_areceber', {
    ...query('fn_areceber.id_cliente', clienteId),
    sortname: 'fn_areceber.data_vencimento',
    sortorder: 'asc',
  });
  const todos = data?.registros ?? [];
  return todos.filter((c) => c.status !== 'P' && c.status !== 'C');
}

async function buscarCobrancasVencidas(diasAtraso = 1, limite = 200) {
  const hoje = new Date();
  const limite_data = new Date(hoje);
  limite_data.setDate(limite_data.getDate() - diasAtraso);
  const dataStr = limite_data.toISOString().split('T')[0];

  const { data } = await ixc.post('/fn_areceber', {
    ...query('fn_areceber.data_vencimento', dataStr, '<='),
    rp: String(limite),
    sortname: 'fn_areceber.data_vencimento',
    sortorder: 'asc',
  });

  const todos = data?.registros ?? [];
  return todos.filter((c) => c.status !== 'P' && c.status !== 'C');
}

async function buscarDetalheCobranca(id) {
  const { data } = await ixc.get(`/fn_areceber/${id}`);
  return {
    id: data.id,
    idCliente: data.id_cliente,
    valor: data.valor,
    valorFormatado: `R$ ${formatarMoeda(data.valor)}`,
    vencimento: data.data_vencimento,
    vencimentoFormatado: formatarData(data.data_vencimento),
    diasAtraso: calcularDiasAtraso(data.data_vencimento),
    linhaDigitavel: data.linha_digitavel || null,
    codigoBarras: data.codigo_barras || null,
    linkBoleto: data.link_boleto || null,
    pixCopiaECola: data.pix_qrcode || data.pix_copia_cola || null,
    status: data.status,
    descricao: data.descricao || '',
  };
}

// ════════════════════════════════════════════════════════════════════════════
//  TICKETS (SU)
// ════════════════════════════════════════════════════════════════════════════

async function abrirTicket({ clienteId, assunto, descricao, prioridade = 'N' }) {
  const { data } = await ixc.post('/su', {
    id_cliente: String(clienteId),
    assunto,
    mensagem: descricao,
    prioridade, // B=Baixa N=Normal A=Alta U=Urgente
    tipo: 'C',
  });
  return data;
}

async function buscarTicketsAbertos(clienteId) {
  const { data } = await ixc.post('/su', query('su.id_cliente', clienteId));
  const tickets = data?.registros ?? [];
  return tickets.filter((t) => t.status !== 'F'); // F = Fechado
}

// ════════════════════════════════════════════════════════════════════════════
module.exports = {
  limparTelefone,
  formatarMoeda,
  formatarData,
  calcularDiasAtraso,
  buscarClientePorId,
  buscarClientePorCpf,
  buscarClientePorTelefone,
  buscarContratosCliente,
  buscarCobrancasAbertas,
  buscarCobrancasVencidas,
  buscarDetalheCobranca,
  abrirTicket,
  buscarTicketsAbertos,
};
