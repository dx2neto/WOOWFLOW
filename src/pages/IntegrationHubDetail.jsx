import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { PageContainer, Card } from '@/components/ui/app-card';
import { base44 } from '@/api/base44Client';
import { ArrowLeft, Save, RefreshCw, Globe, KeyRound, ScrollText, Webhook } from 'lucide-react';

const SECRETS_NEEDED = {
  zapsign: ['ZAPSIGN_API_TOKEN'],
  clicksign: ['CLICKSIGN_ACCESS_TOKEN'],
  omie: ['OMIE_APP_KEY', 'OMIE_APP_SECRET'],
  ixcsoft: ['IXC_API_TOKEN'],
  'evolution-api': ['EVOLUTION_API_KEY'],
  openai: ['OPENAI_API_KEY'],
  claude: ['ANTHROPIC_API_KEY'],
  pagcard: ['PAGCARD_API_KEY'],
};

export default function IntegrationHubDetail() {
  const { slug } = useParams();
  const [integration, setIntegration] = useState(null);
  const [logs, setLogs] = useState([]);
  const [webhooks, setWebhooks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [baseUrl, setBaseUrl] = useState('');
  const [environment, setEnvironment] = useState('production');
  const [extraConfigJson, setExtraConfigJson] = useState('{}');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const list = await base44.entities.Integration.filter({ slug });
      if (list.length === 0) { setIntegration(null); return; }
      const item = list[0];
      setIntegration(item);
      setBaseUrl(item.base_url || '');
      setEnvironment(item.environment || 'production');
      setExtraConfigJson(JSON.stringify(item.extra_config || {}, null, 2));

      const [logList, webhookList] = await Promise.all([
        base44.entities.IntegrationLog.filter({ integration_slug: slug }, '-created_date', 20).catch(() => []),
        base44.entities.IntegrationWebhook.filter({ integration_slug: slug }, '-created_date', 20).catch(() => []),
      ]);
      setLogs(logList);
      setWebhooks(webhookList);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => { load(); }, [load]);

  const handleSave = async () => {
    setSaving(true);
    try {
      let extraConfig = {};
      try { extraConfig = JSON.parse(extraConfigJson); } catch { alert('JSON inválido em extra_config'); setSaving(false); return; }
      await base44.entities.Integration.update(integration.id, { base_url: baseUrl, environment, extra_config: extraConfig });
      await load();
    } catch (err) {
      alert('Erro ao salvar: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <PageContainer><div className="flex justify-center py-20"><RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" /></div></PageContainer>;
  if (!integration) return <PageContainer><p className="text-muted-foreground">Integração não encontrada.</p></PageContainer>;

  const secrets = SECRETS_NEEDED[slug] || [];

  return (
    <PageContainer>
      <Link to="/integration-hub" className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Voltar
      </Link>

      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10"><Globe className="h-5 w-5 text-primary" /></div>
        <div>
          <h2 className="font-heading text-2xl font-bold">{integration.display_name}</h2>
          <p className="text-sm text-muted-foreground">{integration.description || '—'}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Config Form */}
        <Card className="p-5">
          <h3 className="mb-4 font-heading text-lg font-bold">Configuração</h3>
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-xs font-semibold text-muted-foreground">Base URL</label>
              <input value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} className="input-base" placeholder="https://api.exemplo.com/v1" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-muted-foreground">Ambiente</label>
              <select value={environment} onChange={(e) => setEnvironment(e.target.value)} className="input-base">
                <option value="production">Produção</option>
                <option value="sandbox">Sandbox</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-muted-foreground">Extra Config (JSON)</label>
              <textarea value={extraConfigJson} onChange={(e) => setExtraConfigJson(e.target.value)} rows={8} className="w-full rounded-lg border border-border bg-background p-3 font-mono text-xs" />
            </div>
            <button onClick={handleSave} disabled={saving} className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90">
              {saving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Salvar
            </button>
          </div>
        </Card>

        {/* Secrets Info */}
        <Card className="p-5">
          <h3 className="mb-4 flex items-center gap-2 font-heading text-lg font-bold"><KeyRound className="h-5 w-5" /> Secrets Necessários</h3>
          <div className="space-y-2">
            {secrets.length > 0 ? secrets.map((secret) => (
              <div key={secret} className="flex items-center justify-between rounded-lg border border-border bg-muted/30 px-3 py-2">
                <code className="text-sm font-mono">{secret}</code>
              </div>
            )) : <p className="text-sm text-muted-foreground">Nenhum secret necessário.</p>}
          </div>
          <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
            As credenciais são gerenciadas via Secrets do Base44 no dashboard (Settings → Environment Variables), nunca em formulários do frontend.
          </div>
        </Card>
      </div>

      {/* Logs */}
      <Card className="mt-4 p-5">
        <h3 className="mb-4 flex items-center gap-2 font-heading text-lg font-bold"><ScrollText className="h-5 w-5" /> Logs de Chamadas</h3>
        {logs.length === 0 ? <p className="text-sm text-muted-foreground">Nenhum log ainda.</p> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b text-left text-xs text-muted-foreground">
                <th className="py-2 pr-3">Ação</th><th className="py-2 pr-3">Método</th><th className="py-2 pr-3">Status</th><th className="py-2 pr-3">Duração</th><th className="py-2">Data</th>
              </tr></thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id} className="border-b">
                    <td className="py-2 pr-3 font-mono text-xs">{log.action}</td>
                    <td className="py-2 pr-3">{log.method}</td>
                    <td className="py-2 pr-3"><span className={log.status === 'sucesso' ? 'text-green-600' : 'text-red-600'}>{log.response_status || log.status}</span></td>
                    <td className="py-2 pr-3">{log.duration_ms ? `${log.duration_ms}ms` : '—'}</td>
                    <td className="py-2 text-xs text-muted-foreground">{new Date(log.created_date).toLocaleString('pt-BR')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Webhooks */}
      <Card className="mt-4 p-5">
        <h3 className="mb-4 flex items-center gap-2 font-heading text-lg font-bold"><Webhook className="h-5 w-5" /> Webhooks Recebidos</h3>
        {webhooks.length === 0 ? <p className="text-sm text-muted-foreground">Nenhum webhook recebido.</p> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b text-left text-xs text-muted-foreground">
                <th className="py-2 pr-3">Evento</th><th className="py-2 pr-3">Processado</th><th className="py-2">Data</th>
              </tr></thead>
              <tbody>
                {webhooks.map((wh) => (
                  <tr key={wh.id} className="border-b">
                    <td className="py-2 pr-3 font-mono text-xs">{wh.event_type}</td>
                    <td className="py-2 pr-3">{wh.processed ? '✅' : '⏳'}</td>
                    <td className="py-2 text-xs text-muted-foreground">{new Date(wh.created_date).toLocaleString('pt-BR')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </PageContainer>
  );
}