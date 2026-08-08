import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { sendWhatsAppMessage } from '../../shared/evolutionSend.ts';
import { normalizePhoneBR } from '../../shared/salesUtils.ts';
import { logError } from '../../shared/errorLogger.ts';

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);

    // Auth: admin user OR internal token (scheduled workflow)
    const user = await base44.auth.me().catch(() => null);
    const internalToken = Deno.env.get('INTERNAL_FUNCTION_TOKEN') || '';
    const internalOk = internalToken !== '' && req.headers.get('x-internal-token') === internalToken;
    if (!user && !internalOk) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const evoBase  = Deno.env.get('EVOLUTION_API_URL') || '';
    const evoKey   = Deno.env.get('EVOLUTION_API_KEY') || '';
    const evoInst  = Deno.env.get('EVOLUTION_INSTANCE_NAME') || 'CONNECT';
    const managerPhone = Deno.env.get('COMMERCIAL_SECTOR_PHONE') || '';

    // ── Calculate today's range (America/Sao_Paulo) ──────────────────────────
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
    const startISO = startOfDay.toISOString();
    const endISO = now.toISOString();
    const todayBR = now.toLocaleDateString('pt-BR');

    // ── Query today's sales ─────────────────────────────────────────────────
    const allSales = await base44.asServiceRole.entities.Sale.list('-created_date', 500);
    const todaySales = (allSales || []).filter((s: { created_date?: string }) =>
      s.created_date && s.created_date >= startISO && s.created_date <= endISO
    );

    const newLeads    = todaySales.filter((s: { stage: string }) => s.stage === 'novo_lead').length;
    const approved   = todaySales.filter((s: { stage: string }) => s.stage === 'aprovado').length;
    const contractsGenerated = todaySales.filter((s: { stage: string }) => s.stage === 'contrato_gerado' || s.stage === 'assinatura_enviada').length;
    const signed     = todaySales.filter((s: { stage: string }) => s.stage === 'assinado' || s.stage === 'concluido').length;
    const lost       = todaySales.filter((s: { stage: string }) => s.stage === 'perdido').length;
    const totalValue = todaySales.reduce((sum: number, s: { monthly_fee?: number }) => sum + (s.monthly_fee || 0), 0);

    // ── Query today's signed contracts (ZapSign) ──────────────────────────────
    const allSigs = await base44.asServiceRole.entities.SignatureRequest.list('-created_date', 500);
    const todaySigned = (allSigs || []).filter((s: { signed_date?: string; status: string }) =>
      s.status === 'assinado' && s.signed_date && s.signed_date >= startISO.split('T')[0]
    );

    const pendingSigs = (allSigs || []).filter((s: { status: string }) => s.status === 'pendente').length;

    // ── Reseller-specific stats ───────────────────────────────────────────────
    const resellerSales = todaySales.filter((s: { sale_type: string }) => s.sale_type === 'revenda');
    const resellerCount = resellerSales.length;
    const resellerCommission = resellerSales.reduce((sum: number, s: { commission_amount?: number }) => sum + (s.commission_amount || 0), 0);

    // ── Build summary message ────────────────────────────────────────────────
    const fmtBRL = (v: number) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

    let msg = `📊 *RESUMO DIÁRIO DE VENDAS*\n📅 ${todayBR}\n`;
    msg += `━━━━━━━━━━━━━━━\n`;
    msg += `🆕 Novos leads: *${todaySales.length}*\n`;
    msg += `✅ Aprovados (crédito): *${approved}*\n`;
    msg += `📄 Contratos gerados: *${contractsGenerated}*\n`;
    msg += `📝 Contratos assinados hoje: *${todaySigned.length}*\n`;
    msg += `⏳ Aguardando assinatura: *${pendingSigs}*\n`;
    msg += `❌ Perdidos: *${lost}*\n`;
    msg += `━━━━━━━━━━━━━━━\n`;
    msg += `💰 MRR estimado: *${fmtBRL(totalValue)}*\n`;
    if (resellerCount > 0) {
      msg += `🤝 Vendas via revenda: *${resellerCount}*\n`;
      msg += `💵 Comissões a pagar: *${fmtBRL(resellerCommission)}*\n`;
    }
    msg += `━━━━━━━━━━━━━━━\n`;
    msg += `🔗 Acesse o painel para detalhes.`;

    // ── Send via WhatsApp to commercial manager ───────────────────────────────
    let whatsappSent = false;
    if (managerPhone) {
      const number = normalizePhoneBR(managerPhone);
      const result = await sendWhatsAppMessage({
        base: evoBase, apiKey: evoKey, instanceName: evoInst, number, text: msg,
      });
      whatsappSent = result.success;
    }

    // ── Log result ───────────────────────────────────────────────────────────
    await base44.asServiceRole.entities.IntegrationLog.create({
      integration: 'salesPipelineApi',
      action: 'daily_summary',
      status: whatsappSent ? 'sucesso' : 'falha',
      details: `date=${todayBR} sales=${todaySales.length} signed=${todaySigned.length} pending=${pendingSigs} whatsapp=${whatsappSent}`,
    });

    return Response.json({
      success: true,
      data: {
        date: todayBR,
        totalSales: todaySales.length,
        newLeads,
        approved,
        contractsGenerated,
        signedToday: todaySigned.length,
        pendingSignatures: pendingSigs,
        lost,
        totalMRR: totalValue,
        resellerSales: resellerCount,
        resellerCommission,
        whatsappSent,
      },
    });
  } catch (error) {
    const base44 = createClientFromRequest(req);
    await logError(base44, 'sendDailySalesSummary', error, { action: 'daily_summary', severity: 'alta' });
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
}