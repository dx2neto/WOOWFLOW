import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { PageContainer, Card } from '@/components/ui/app-card';
import { base44 } from '@/api/base44Client';
import { CheckCircle, XCircle, Globe, Settings, RefreshCw } from 'lucide-react';

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

export default function IntegrationHub() {
  const [integrations, setIntegrations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const list = await base44.entities.Integration.list('display_name', 100);
      setIntegrations(list);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const toggleEnabled = async (integration) => {
    setToggling(integration.id);
    try {
      await base44.entities.Integration.update(integration.id, { enabled: !integration.enabled });
      setIntegrations((prev) => prev.map((i) => i.id === integration.id ? { ...i, enabled: !i.enabled } : i));
    } catch (err) {
      console.error(err);
    } finally {
      setToggling(null);
    }
  };

  return (
    <PageContainer>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="font-heading text-2xl font-bold">Integration Hub</h2>
          <p className="text-sm text-muted-foreground">Gerencie credenciais, status e logs de todas as integrações externas.</p>
        </div>
        <button onClick={load} disabled={loading} className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm hover:bg-muted">
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Atualizar
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {integrations.map((integration) => {
            const enabled = integration.enabled === true;
            const env = integration.environment || 'production';
            const secrets = SECRETS_NEEDED[integration.slug] || [];
            return (
              <Card key={integration.id} className="flex min-h-[200px] flex-col p-5">
                <div className="mb-3 flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                      <Globe className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <h4 className="font-heading text-base font-bold">{integration.display_name}</h4>
                      <p className="text-xs text-muted-foreground">{integration.slug}</p>
                    </div>
                  </div>
                  <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold ${enabled ? 'border-green-200 bg-green-50 text-green-700' : 'border-gray-200 bg-gray-50 text-gray-600'}`}>
                    {enabled ? <CheckCircle className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
                    {enabled ? 'Ativo' : 'Inativo'}
                  </span>
                </div>

                <p className="mb-3 flex-1 text-sm text-muted-foreground">{integration.description || '—'}</p>

                <div className="mb-3 space-y-1 text-xs text-muted-foreground">
                  <div className="flex justify-between"><span>Ambiente:</span><span className="font-medium text-foreground">{env === 'sandbox' ? 'Sandbox' : 'Produção'}</span></div>
                  <div className="flex justify-between"><span>Secrets:</span><span className="font-medium text-foreground">{secrets.length} necessário(s)</span></div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => toggleEnabled(integration)}
                    disabled={toggling === integration.id}
                    className={`flex-1 rounded-lg px-3 py-2 text-xs font-semibold transition-colors ${enabled ? 'bg-red-50 text-red-700 hover:bg-red-100' : 'bg-green-50 text-green-700 hover:bg-green-100'}`}
                  >
                    {toggling === integration.id ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : enabled ? 'Desabilitar' : 'Habilitar'}
                  </button>
                  <Link
                    to={`/integration-hub/${integration.slug}`}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs font-semibold hover:bg-muted"
                  >
                    <Settings className="h-3.5 w-3.5" /> Detalhes
                  </Link>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </PageContainer>
  );
}