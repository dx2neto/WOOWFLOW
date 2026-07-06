import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { syncGoogleSheets } from "@/functions/syncGoogleSheets";
import { Card } from "@/components/ui/app-card";
import { Sheet, RefreshCw } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

const CONNECTOR_ID = "6a4b4340824be09549e87579";

export default function GoogleSheetsSyncCard() {
  const [user, setUser] = useState(null);
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [spreadsheetId, setSpreadsheetId] = useState("");
  const [configId, setConfigId] = useState(null);
  const [syncing, setSyncing] = useState(false);
  const { toast } = useToast();

  const checkConnection = async () => {
    try {
      await syncGoogleSheets({});
      setConnected(true);
    } catch {
      setConnected(false);
    }
  };

  useEffect(() => {
    (async () => {
      const authed = await base44.auth.isAuthenticated();
      if (authed) {
        const me = await base44.auth.me();
        setUser(me);
        await checkConnection();
        const configs = await base44.entities.IntegrationConfig.filter({ service: "google_sheets" });
        if (configs[0]) {
          setConfigId(configs[0].id);
          setSpreadsheetId(configs[0].config?.spreadsheet_id || "");
        }
      }
      setLoading(false);
    })();
  }, []);

  const handleConnect = async () => {
    const url = await base44.connectors.connectAppUser(CONNECTOR_ID);
    const popup = window.open(url, "_blank");
    const timer = setInterval(() => {
      if (!popup || popup.closed) {
        clearInterval(timer);
        checkConnection();
      }
    }, 500);
  };

  const handleDisconnect = async () => {
    await base44.connectors.disconnectAppUser(CONNECTOR_ID);
    setConnected(false);
  };

  const saveSpreadsheetId = async (value) => {
    setSpreadsheetId(value);
    if (configId) {
      await base44.entities.IntegrationConfig.update(configId, { config: { spreadsheet_id: value } });
    } else {
      const created = await base44.entities.IntegrationConfig.create({
        service: "google_sheets",
        display_name: "Google Sheets",
        status: "connected",
        config: { spreadsheet_id: value },
      });
      setConfigId(created.id);
    }
  };

  const handleSync = async () => {
    if (!spreadsheetId) {
      toast({ title: "Informe o ID da planilha", variant: "destructive" });
      return;
    }
    setSyncing(true);
    try {
      const res = await syncGoogleSheets({ spreadsheetId });
      if (res?.data?.error) {
        toast({ title: "Falha ao sincronizar", description: res.data.error, variant: "destructive" });
        return;
      }
      if (configId) await base44.entities.IntegrationConfig.update(configId, { last_sync: new Date().toISOString() });
      toast({ title: `${res?.data?.total || 0} clientes sincronizados com sucesso` });
    } catch {
      toast({ title: "Erro ao sincronizar", variant: "destructive" });
    } finally {
      setSyncing(false);
    }
  };

  if (loading) return null;

  return (
    <Card className="p-5 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-4">
        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500 to-green-600 flex items-center justify-center">
          <Sheet className="w-6 h-6 text-white" />
        </div>
        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${connected ? "text-green-600 bg-green-50" : "text-gray-500 bg-gray-50"}`}>
          {connected ? "Conectado" : "Desconectado"}
        </span>
      </div>
      <h3 className="font-semibold mb-1">Google Sheets</h3>
      <p className="text-sm text-muted-foreground mb-4">Sincronize dados financeiros de clientes do IXCSoft com uma planilha</p>

      {!user ? (
        <button onClick={() => base44.auth.redirectToLogin()} className="w-full py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90">
          Fazer login para conectar
        </button>
      ) : !connected ? (
        <button onClick={handleConnect} className="w-full py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90">
          Conectar Google Sheets
        </button>
      ) : (
        <div className="space-y-3">
          <input
            type="text"
            value={spreadsheetId}
            onChange={(e) => saveSpreadsheetId(e.target.value)}
            placeholder="ID da planilha do Google Sheets"
            className="w-full h-9 px-3 bg-muted/60 rounded-lg text-sm focus:outline-none focus:bg-card focus:ring-1 focus:ring-primary"
          />
          <div className="flex gap-2">
            <button onClick={handleSync} disabled={syncing} className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50">
              <RefreshCw className={`w-4 h-4 ${syncing ? "animate-spin" : ""}`} /> {syncing ? "Sincronizando..." : "Sincronizar agora"}
            </button>
            <button onClick={handleDisconnect} className="px-3 py-2 border border-border rounded-lg text-sm font-medium hover:bg-muted">
              Desconectar
            </button>
          </div>
        </div>
      )}
    </Card>
  );
}