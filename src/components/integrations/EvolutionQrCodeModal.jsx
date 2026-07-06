import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { evolutionApi } from "@/functions/evolutionApi";
import { useToast } from "@/components/ui/use-toast";
import { X, RefreshCw, QrCode as QrCodeIcon, CheckCircle, XCircle } from "lucide-react";

export default function EvolutionQrCodeModal({ onClose }) {
  const [instances, setInstances] = useState([]);
  const [selected, setSelected] = useState("");
  const [qrImage, setQrImage] = useState(null);
  const [loadingInstances, setLoadingInstances] = useState(true);
  const [loadingQr, setLoadingQr] = useState(false);
  const [tab, setTab] = useState("qrcode");
  const [history, setHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const { toast } = useToast();

  useEffect(() => { loadInstances(); }, []);
  useEffect(() => { if (selected) loadQrCode(selected); }, [selected]);
  useEffect(() => { if (tab === "history") loadHistory(); }, [tab]);

  const loadHistory = async () => {
    setLoadingHistory(true);
    try {
      const logs = await base44.entities.IntegrationLog.filter({ integration: "evolutionApi", action: "get_qrcode" }, "-created_date", 50);
      setHistory(logs);
    } catch {
      setHistory([]);
    } finally {
      setLoadingHistory(false);
    }
  };

  const lastSuccess = history.find((h) => h.status === "sucesso");

  const loadInstances = async () => {
    setLoadingInstances(true);
    try {
      const response = await evolutionApi({});
      const list = response?.data?.instances || [];
      setInstances(list);
      const first = list[0]?.name || list[0]?.instance?.instanceName || "";
      if (first) setSelected(first);
    } catch {
      setInstances([]);
    } finally {
      setLoadingInstances(false);
    }
  };

  const loadQrCode = async (instanceName) => {
    setQrImage(null);
    setLoadingQr(true);
    try {
      const response = await evolutionApi({ action: "get_qrcode", instanceName });
      if (response?.data?.error) {
        toast({ title: "Falha ao obter QR code", variant: "destructive" });
        return;
      }
      const qr = response?.data?.qrcode || {};
      const base64 = (qr.base64 || qr.qrcode?.base64 || qr.code || "").split("|")[0];
      setQrImage(base64 || null);
    } catch {
      toast({ title: "Erro ao obter QR code", variant: "destructive" });
    } finally {
      setLoadingQr(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-card rounded-xl w-full max-w-md flex flex-col">
        <div className="flex items-center justify-between p-5 border-b border-border">
          <h3 className="font-semibold text-lg">QR Code da Instância</h3>
          <button onClick={onClose} className="p-1.5 hover:bg-muted rounded-lg">
            <X className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>

        <div className="flex border-b border-border flex-shrink-0">
          <button
            onClick={() => setTab("qrcode")}
            className={`flex-1 py-2.5 text-sm font-medium ${tab === "qrcode" ? "text-primary border-b-2 border-primary" : "text-muted-foreground"}`}
          >
            QR Code
          </button>
          <button
            onClick={() => setTab("history")}
            className={`flex-1 py-2.5 text-sm font-medium ${tab === "history" ? "text-primary border-b-2 border-primary" : "text-muted-foreground"}`}
          >
            Histórico de Conexão
          </button>
        </div>

        <div className="p-5 space-y-4">
          {tab === "qrcode" ? (
            loadingInstances ? (
              <p className="text-center text-sm text-muted-foreground py-4">Carregando instâncias...</p>
            ) : instances.length === 0 ? (
              <p className="text-center text-sm text-muted-foreground py-4">Nenhuma instância cadastrada</p>
            ) : (
              <>
                <select
                  value={selected}
                  onChange={(e) => setSelected(e.target.value)}
                  className="w-full h-10 px-3 bg-muted/60 rounded-lg text-sm focus:outline-none focus:bg-card focus:ring-1 focus:ring-primary"
                >
                  {instances.map((inst) => {
                    const name = inst.name || inst.instance?.instanceName || "";
                    return <option key={name} value={name}>{name}</option>;
                  })}
                </select>

                <div className="flex flex-col items-center justify-center border border-border rounded-lg p-6 min-h-[240px]">
                  {loadingQr ? (
                    <p className="text-sm text-muted-foreground">Gerando QR code...</p>
                  ) : qrImage ? (
                    <img
                      src={qrImage.startsWith("data:") ? qrImage : `data:image/png;base64,${qrImage}`}
                      alt={`QR Code ${selected}`}
                      className="w-52 h-52 object-contain"
                    />
                  ) : (
                    <div className="text-center">
                      <QrCodeIcon className="w-10 h-10 text-muted-foreground/40 mx-auto mb-2" />
                      <p className="text-sm text-muted-foreground">QR code indisponível. A instância pode já estar conectada.</p>
                    </div>
                  )}
                </div>

                <button
                  onClick={() => loadQrCode(selected)}
                  disabled={loadingQr}
                  className="w-full flex items-center justify-center gap-2 py-2.5 border border-border rounded-lg text-sm font-medium hover:bg-muted disabled:opacity-50"
                >
                  <RefreshCw className={`w-4 h-4 ${loadingQr ? "animate-spin" : ""}`} /> Atualizar QR Code
                </button>

                <p className="text-xs text-muted-foreground text-center">Escaneie com o WhatsApp em Aparelhos Conectados para conectar "{selected}"</p>
              </>
            )
          ) : (
            <>
              <div className="rounded-lg bg-muted/40 border border-border p-3">
                <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">Última conexão bem-sucedida</p>
                <p className="text-sm">
                  {lastSuccess
                    ? new Date(lastSuccess.created_date).toLocaleString("pt-BR")
                    : "Nenhuma conexão bem-sucedida registrada"}
                </p>
              </div>

              <div className="max-h-72 overflow-y-auto scrollbar-thin space-y-2">
                {loadingHistory ? (
                  <p className="text-center text-sm text-muted-foreground py-4">Carregando histórico...</p>
                ) : history.length === 0 ? (
                  <p className="text-center text-sm text-muted-foreground py-4">Nenhuma tentativa registrada ainda</p>
                ) : (
                  history.map((h) => (
                    <div key={h.id} className="flex items-start gap-2 p-2.5 border border-border rounded-lg">
                      {h.status === "sucesso" ? (
                        <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                      ) : (
                        <XCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium">{h.status === "sucesso" ? "QR code gerado com sucesso" : "Falha ao gerar QR code"}</p>
                        {h.details && <p className="text-xs text-muted-foreground truncate">{h.details}</p>}
                        <p className="text-xs text-muted-foreground">{new Date(h.created_date).toLocaleString("pt-BR")}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}