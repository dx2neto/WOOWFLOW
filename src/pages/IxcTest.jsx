import React, { useState } from "react";
import { PageContainer, Card } from "@/components/ui/app-card";
import { ixcApi } from "@/functions/ixcApi";
import { CheckCircle, XCircle, Loader2, Plug, Clock, Users, AlertTriangle } from "lucide-react";

export default function IxcTest() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  const testConnection = async () => {
    setLoading(true);
    setResult(null);
    try {
      const res = await ixcApi({ action: "test_connection" });
      setResult(res?.data || { success: false, error: "Resposta inválida do servidor" });
    } catch (err) {
      setResult({ success: false, error: err?.message || "Erro ao chamar o servidor" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <PageContainer>
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-bold font-heading">Teste de Conexão IXCSoft</h2>
          <p className="text-sm text-muted-foreground">
            Verifica se as credenciais do IXCSoft estão configuradas e se a API responde
          </p>
        </div>
      </div>

      <div className="max-w-2xl">
        <Card title="Verificação de Integração IXCSoft" className="p-6 mb-4">
          <p className="text-sm text-muted-foreground mb-4">
            Esta rota verifica se as variáveis de ambiente <code className="bg-muted px-1 py-0.5 rounded text-xs">IXC_API_URL</code> e{" "}
            <code className="bg-muted px-1 py-0.5 rounded text-xs">IXC_API_TOKEN</code> estão configuradas no servidor e se a API
            do IXCSoft responde corretamente.
          </p>

          <button
            onClick={testConnection}
            disabled={loading}
            className="flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-60"
          >
            {loading ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Testando...</>
            ) : (
              <><Plug className="w-4 h-4" /> Testar conexão</>
            )}
          </button>

          {result && (
            <div className={`mt-5 p-4 rounded-lg border ${result.success ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200"}`}>
              <div className="flex items-center gap-2 mb-3">
                {result.success
                  ? <CheckCircle className="w-5 h-5 text-green-600" />
                  : <XCircle className="w-5 h-5 text-red-600" />
                }
                <span className={`font-semibold text-sm ${result.success ? "text-green-700" : "text-red-700"}`}>
                  {result.success ? "Conexão estabelecida com sucesso" : "Falha na conexão"}
                </span>
              </div>

              {result.success && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex items-center gap-2 text-sm text-green-700">
                    <Clock className="w-4 h-4" />
                    Tempo de resposta: <strong>{result.response_ms}ms</strong>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-green-700">
                    <Users className="w-4 h-4" />
                    Total de clientes: <strong>{result.total_clientes}</strong>
                  </div>
                </div>
              )}

              {!result.success && (
                <p className="text-sm text-red-700">
                  {result.error || "Verifique as variáveis de ambiente IXC_API_URL e IXC_API_TOKEN."}
                </p>
              )}
            </div>
          )}
        </Card>

        <Card title="Variáveis de Ambiente Necessárias" className="p-6">
          <div className="space-y-3 text-sm">
            <div className="flex items-start gap-3 p-3 bg-muted/40 rounded-lg">
              <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-semibold">IXC_API_URL</p>
                <p className="text-muted-foreground">URL base da API do IXCSoft, ex: <code className="bg-muted px-1 rounded text-xs">https://seuprovedor.ixcprovedor.com.br/webservice/v1</code></p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-3 bg-muted/40 rounded-lg">
              <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-semibold">IXC_API_TOKEN</p>
                <p className="text-muted-foreground">Token em Base64 no formato <code className="bg-muted px-1 rounded text-xs">usuario:token</code> — nunca exposto no frontend.</p>
              </div>
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-4">
            Configure essas variáveis no painel do Base44 em <strong>Configurações → Variáveis de Ambiente</strong> ou no arquivo <code>.env.local</code> para desenvolvimento.
          </p>
        </Card>
      </div>
    </PageContainer>
  );
}
