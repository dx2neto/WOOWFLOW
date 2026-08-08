/**
 * Normaliza um número de telefone brasileiro para o formato da Evolution API.
 * Remove espacos, parenteses, hifens. Garante DDI 55 sem duplicacao.
 *
 * @param raw - Numero bruto (ex: "+55 (11) 99999-9999", "11999999999")
 * @returns string normalizada (ex: "5511999999999") ou string vazia se invalido
 */
export function normalizePhoneBR(raw: string): string {
  if (!raw) return '';
  let digits = String(raw).replace(/\D/g, '');

  // Remove zeros a esquerda que alguns sistemas adicionam
  digits = digits.replace(/^0+/, '');

  // Se ja tem DDI 55 e tem 13 digitos (55 + DDD + 9 digitos), mantem
  // Se tem 12 digitos com 55 (55 + DDD + 8 digitos), mantem
  // Se tem 11 digitos (DDD + 9 digitos), adiciona 55
  // Se tem 10 digitos (DDD + 8 digitos), adiciona 55
  if (digits.startsWith('55') && (digits.length === 13 || digits.length === 12)) {
    return digits;
  }
  if (digits.length === 11 || digits.length === 10) {
    return '55' + digits;
  }
  // Se tem 13+ digitos mas nao comeca com 55, pode ser outro DDI
  if (digits.length >= 10) {
    return digits;
  }
  return '';
}

/**
 * Mascara um CPF/CNPJ para exibicao em logs e relatorios (LGPD).
 * CPF: ---.---.--- -XX | CNPJ: --.---.--- ---- -XX
 */
export function maskDocument(doc: string): string {
  const d = String(doc || '').replace(/\D/g, '');
  if (d.length === 11) return '---.---.--- -' + d.slice(-2);
  if (d.length === 14) return '--.---.--- ---- -' + d.slice(-2);
  return d ? '---' + d.slice(-4) : '';
}

/**
 * Gera um correlation ID unico para rastrear a venda entre todas as integracoes.
 */
export function generateCorrelationId(): string {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 8);
  return 'SALE-' + ts + '-' + rand;
}

/**
 * Adiciona uma entrada ao timeline de uma Sale.
 */
export function buildTimelineEntry(stage: string, description: string) {
  return {
    stage,
    timestamp: new Date().toISOString(),
    description,
  };
}