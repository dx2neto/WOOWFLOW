export const trunkTypes = {
  sip_trunk: "SIP Trunk", e1_ip: "E1 IP", gateway_e1: "Gateway E1", operadora_voip: "Operadora VoIP",
  pabx_externo: "PABX Externo", asterisk: "Asterisk", issabel: "Issabel", freepbx: "FreePBX",
  "3cx": "3CX", api_externa: "API Externa",
};

export const trunkStatus = {
  online: { label: "Online", color: "text-green-600 bg-green-50" },
  offline: { label: "Offline", color: "text-gray-500 bg-gray-50" },
  registrado: { label: "Registrado", color: "text-blue-600 bg-blue-50" },
  nao_registrado: { label: "Não Registrado", color: "text-amber-600 bg-amber-50" },
  falha_autenticacao: { label: "Falha de Autenticação", color: "text-red-600 bg-red-50" },
  indisponivel: { label: "Indisponível", color: "text-red-600 bg-red-50" },
  manutencao: { label: "Em Manutenção", color: "text-amber-600 bg-amber-50" },
};

export const linkStatus = {
  online: { label: "Online", color: "text-green-600 bg-green-50" },
  offline: { label: "Offline", color: "text-gray-500 bg-gray-50" },
  falha: { label: "Falha", color: "text-red-600 bg-red-50" },
};

export const destinationTypes = {
  ura: "URA", fila: "Fila", ramal: "Ramal", setor: "Setor", grupo_atendimento: "Grupo de Atendimento",
  atendimento_geral: "Atendimento Geral", financeiro: "Financeiro", suporte_tecnico: "Suporte Técnico",
  comercial: "Comercial", cobranca: "Cobrança", retencao: "Retenção", ouvidoria: "Ouvidoria", noc: "NOC",
  encerrar_chamada: "Encerrar Chamada", mensagem_audio: "Mensagem de Áudio", callback_automatico: "Callback Automático",
};

export const callTypes = {
  local: "Local", ddd: "DDD", ddi: "DDI", celular: "Celular", fixo: "Fixo", "0800": "0800", "0300": "0300",
  interno: "Interno", emergencia: "Emergência", cobranca: "Cobrança", comercial: "Comercial", suporte: "Suporte",
};

export const extensionPermissions = {
  chamadas_internas: "Chamadas Internas", chamadas_externas: "Chamadas Externas", ddd: "DDD", ddi: "DDI",
  celular: "Celular", transferir: "Transferir", gravar: "Gravar", ouvir_proprias: "Ouvir Próprias",
  ouvir_equipe: "Ouvir da Equipe", rota_comercial: "Rota Comercial", rota_financeira: "Rota Financeira",
  rota_suporte: "Rota Suporte", discador: "Discador", campanhas: "Campanhas",
};

export const queueStrategies = {
  ringall: "Tocar Todos", leastrecent: "Menos Recente", fewestcalls: "Menos Chamadas",
  random: "Aleatório", roundrobin: "Round Robin",
};

export const callStatus = {
  em_andamento: { label: "Em Andamento", color: "text-blue-600 bg-blue-50" },
  aguardando: { label: "Aguardando", color: "text-amber-600 bg-amber-50" },
  atendida: { label: "Atendida", color: "text-green-600 bg-green-50" },
  perdida: { label: "Perdida", color: "text-red-600 bg-red-50" },
  abandonada: { label: "Abandonada", color: "text-red-600 bg-red-50" },
  transferida: { label: "Transferida", color: "text-purple-600 bg-purple-50" },
  finalizada: { label: "Finalizada", color: "text-gray-600 bg-gray-100" },
};

export const sentiments = {
  positivo: { label: "Positivo", color: "text-green-600 bg-green-50" },
  neutro: { label: "Neutro", color: "text-gray-500 bg-gray-50" },
  negativo: { label: "Negativo", color: "text-red-600 bg-red-50" },
};

export const callReasons = {
  financeiro: "Financeiro", segunda_via: "Segunda Via", pix: "PIX", suporte_tecnico: "Suporte Técnico",
  internet_lenta: "Internet Lenta", sem_conexao: "Sem Conexão", agendamento: "Agendamento", comercial: "Comercial",
  mudanca_plano: "Mudança de Plano", cancelamento: "Cancelamento", reclamacao: "Reclamação", retencao: "Retenção",
  ouvidoria: "Ouvidoria", contrato: "Contrato", nota_fiscal: "Nota Fiscal",
};

export const signalingTypes = {
  r2_digital: "R2 Digital", isdn: "ISDN", sip_convertido: "SIP Convertido",
  e1_para_sip: "E1 para SIP", gateway_externo: "Gateway Externo",
};