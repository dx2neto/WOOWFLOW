import React, { useState, useEffect, useRef, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { evolutionApi } from "@/functions/evolutionApi";
import { useToast } from "@/components/ui/use-toast";
import {
  X, RefreshCw, QrCode as QrCodeIcon, CheckCircle, XCircle,
  Wifi, WifiOff, Loader2, RotateCcw, AlertCircle, Smartphone
} from "lucide-react";

function StateBadge({ state }) {
  const cfg = {
    connected:    { label: "Conectado",    cls: "bg-green-100 text-green-700", Icon: Wifi },
    connecting:   { label: "Aguard. scan", cls: "bg-amber-100 text-amber-700", Icon: QrCodeIcon },
    disconnected: { label: "Desconectado", cls: "bg-red-100 text-red-600",     Icon: WifiOff },
    unknown:      { label: "Desconhecido", cls: "bg-gray-100 text-gray-600",   Icon: AlertCircle },
  }[state] || { label: state, cls: "bg-gray-100 text-gray-600", Icon: AlertCircle };
  const { label, cls, Icon } = cfg;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${cls}`}>
      <Icon className="w-3 h-3" /> {label}
    </span>
  );
}

function normalizeQrImage(value) {
  if (!value || typeof value !== "string") return null;
  return value.startsWith("data:") ? value : `data:image/png;base64,${value}`;
}

function qrPayloadFromResponse(data) {
  if (typeof data?.qrcode === "string") return { base64: data.qrcode, code: null };
  return data?.qrcode || data?.qrCode || null;
}

function evolutionErrorMessage(data, fallback) {
  const message = data?.error?.message || data?.error || data?.message || fallback;
  if (/authentication required|view users|unauthorized/i.test(String(message))) {
    return "Faça login na Base44 para gerar QR Code e gerenciar instâncias.";
  }
  return message;
}

export default function EvolutionQrCodeModal({ onClose }) {
  const { toast } = useToast();
  const [tab, setTab]           = useState("qrcode");
  const [instances, setInstances] = useState([]);
  const [selected, setSelected] = useState("");
  const [state, setState]       = useState(null);
  const [qrImage, setQrImage]   = useState(null);
  const [pairingCode, setPairingCode] = useState(null);
  const [loadingInst, setLoadingInst] = useState(true);
  const [loadingQr, setLoadingQr]     = useState(false);
  const [connecting, setConnecting]   = useState(false);
  const [error, setError]       = useState(null);
  const [history, setHistory]   = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const pollRef = useRef(null);
  const refreshRef = useRef(null);

  // ── Load instances ─────────────────────────────────────────────────────────
  const loadInstances = useCallback(async () => {
    setLoadingInst(true);
    try {
      const res = await evolutionApi({ action: "list_instances" });
      if (res?.data?.error || res?.data?.success === false) {
        setInstances([]);
        setError(evolutionErrorMessage(res.data, "Falha ao carregar instâncias"));
        return;
      }
      const list = res?.data?.instances || [];
      setInstances(list);
      if (!selected && list.length > 0) {
        setSelected(list[0].name || "");
      }
    } catch {
      setInstances([]);
      setError("Erro ao carregar instâncias da Evolution Go");
    } finally {
      setLoadingInst(false);
    }
  }, [selected]);

  useEffect(() => { loadInstances(); }, []);

  // ── Fetch QR code ──────────────────────────────────────────────────────────
  const fetchQr = useCallback(async (silent = false) => {
    if (!selected) return;
    if (!silent) { setLoadingQr(true); setError(null); setQrImage(null); setPairingCode(null); }
    try {
      const res = await evolutionApi({ action: "get_qrcode", instanceName: selected });
      const d   = res?.data;

      if (d?.state === "connected") {
        setState("connected");
        setQrImage(null);
        setPairingCode(null);
        setError(null);
        clearPolling();
        return;
      }

      if (d?.success) {
        const qr = qrPayloadFromResponse(d);
        const image = normalizeQrImage(qr?.base64);
        if (image || qr?.code) {
          setQrImage(image);
          setPairingCode(qr?.code || null);
          setState("connecting");
          setError(null);
        }
      } else {
        setError(evolutionErrorMessage(d, "QR code indisponível. Clique em Reconectar para gerar um novo."));
        setQrImage(null);
        setPairingCode(null);
        if (d?.state) setState(d.state);
      }
    } catch {
      if (!silent) setError("Erro de conexão ao buscar QR code");
    } finally {
      if (!silent) setLoadingQr(false);
    }
  }, [selected]);

  // ── Poll connection state every 5s when QR is visible ─────────────────────
  const clearPolling = () => {
    clearInterval(pollRef.current);
    clearInterval(refreshRef.current);
    pollRef.current = null;
    refreshRef.current = null;
  };

  const checkConnected = useCallback(async () => {
    if (!selected) return;
    try {
      const res = await evolutionApi({ action: "get_status", instanceName: selected });
      const s = res?.data?.state || res?.data?.instance?.state;
      if (s === "connected") {
        setState("connected");
        setQrImage(null);
        setPairingCode(null);
        setError(null);
        clearPolling();
        toast({ title: `✅ ${selected} conectado com sucesso!` });
        await loadInstances();
      }
    } catch { /* silent */ }
  }, [selected, toast, loadInstances]);

  // Start polling when QR is shown
  useEffect(() => {
    clearPolling();
    if (qrImage || pairingCode) {
      pollRef.current   = setInterval(checkConnected, 5000);   // verifica conexão
      refreshRef.current = setInterval(() => fetchQr(true), 25000); // atualiza QR
    }
    return clearPolling;
  }, [qrImage, pairingCode, checkConnected, fetchQr]);

  // Load QR when instance changes
  useEffect(() => {
    if (selected) {
      setQrImage(null);
      setPairingCode(null);
      setState(null);
      setError(null);
      fetchQr();
    }
  }, [selected]);

  // ── Reconnect ──────────────────────────────────────────────────────────────
  const handleReconnect = async () => {
    if (!selected || connecting) return;
    setConnecting(true);
    setQrImage(null);
    setPairingCode(null);
    setError(null);
    try {
      const res = await evolutionApi({ action: "connect_instance", instanceName: selected });
      const d = res?.data;
      if (d?.error || d?.success === false) {
        setError(evolutionErrorMessage(d, "Falha ao reconectar. Tente novamente."));
        return;
      }
      const qr = qrPayloadFromResponse(d);
      const image = normalizeQrImage(qr?.base64);
      if (d?.state === "connected") {
        setState("connected");
        return;
      }
      if (image || qr?.code) {
        setQrImage(image);
        setPairingCode(qr?.code || null);
        setState("connecting");
        return;
      }
      await new Promise((r) => setTimeout(r, 1200));
      await fetchQr();
    } catch {
      setError("Falha ao reconectar. Tente novamente.");
    } finally {
      setConnecting(false);
    }
  };

  // ── History ────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (tab === "history") {
      setLoadingHistory(true);
      base44.entities.IntegrationLog.filter(
        { integration: "evolutionApi" }, "-created_date", 60
      ).then((logs) => setHistory(logs || [])).catch(() => setHistory([])).finally(() => setLoadingHistory(false));
    }
  }, [tab]);

  const lastSuccess = history.find((h) => h.status === "sucesso" && h.action === "list_instances");

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-card rounded-2xl w-full max-w-md flex flex-col shadow-2xl max-h-[90vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h3 className="font-bold text-base">Conexão WhatsApp — Evolution Go</h3>
          <button onClick={onClose} className="p-1.5 hover:bg-muted rounded-lg">
            <X className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-border">
          {[["qrcode", "QR Code"], ["history", "Histórico"]].map(([key, label]) => (
            <button key={key} onClick={() => setTab(key)}
              className={`flex-1 py-2.5 text-sm font-medium transition-colors ${tab === key ? "text-primary border-b-2 border-primary" : "text-muted-foreground hover:text-foreground"}`}>
              {label}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {tab === "qrcode" && (
            <>
              {/* Instance selector */}
              {loadingInst ? (
                <div className="flex items-center gap-2 text-muted-foreground text-sm">
                  <Loader2 className="w-4 h-4 animate-spin" /> Carregando instâncias...
                </div>
              ) : instances.length === 0 ? (
                <div className="text-center py-4">
                  {error ? (
                    <>
                      <AlertCircle className="w-8 h-8 text-amber-500 mx-auto mb-2" />
                      <p className="text-sm font-medium">Evolution Go indisponível</p>
                      <p className="text-xs text-muted-foreground mt-1">{error}</p>
                    </>
                  ) : (
                    <>
                      <Smartphone className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
                      <p className="text-sm text-muted-foreground">Nenhuma instância encontrada. Crie uma em Integrações → Gerenciar Instâncias.</p>
                    </>
                  )}
                </div>
              ) : (
                <>
                  {/* Selector + status */}
                  <div className="flex items-center gap-2">
                    <select
                      value={selected}
                      onChange={(e) => setSelected(e.target.value)}
                      className="flex-1 h-9 px-3 bg-muted/60 rounded-lg text-sm font-mono focus:outline-none focus:ring-1 focus:ring-primary"
                    >
                      {instances.map((inst) => (
                        <option key={inst.name} value={inst.name}>{inst.name}</option>
                      ))}
                    </select>
                    {state && <StateBadge state={state} />}
                  </div>

                  {/* QR / Status display */}
                  <div className="flex flex-col items-center justify-center border border-border rounded-xl p-6 min-h-[260px] bg-muted/10">
                    {loadingQr || connecting ? (
                      <div className="flex flex-col items-center gap-2">
                        <Loader2 className="w-10 h-10 animate-spin text-primary" />
                        <p className="text-sm text-muted-foreground">{connecting ? "Gerando novo QR code..." : "Buscando QR code..."}</p>
                      </div>
                    ) : state === "connected" ? (
                      <div className="flex flex-col items-center gap-3">
                        <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
                          <CheckCircle className="w-8 h-8 text-green-600" />
                        </div>
                        <p className="font-semibold text-green-700">Conectado!</p>
                        <p className="text-xs text-muted-foreground text-center">A instância <strong>{selected}</strong> está conectada e pronta para uso.</p>
                      </div>
                    ) : qrImage ? (
                      <div className="flex flex-col items-center gap-3">
                        <img src={qrImage} alt="QR Code" className="w-52 h-52 rounded-lg border border-border object-contain bg-white p-1" />
                        <div className="flex items-center gap-1.5 text-xs text-amber-600 font-medium">
                          <div className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                          Aguardando scan... atualiza a cada 25s
                        </div>
                      </div>
                    ) : pairingCode ? (
                      <div className="flex flex-col items-center gap-3">
                        <QrCodeIcon className="w-12 h-12 text-amber-500" />
                        <p className="text-sm font-semibold">Código de pareamento</p>
                        <div className="rounded-lg border border-border bg-background px-3 py-2 font-mono text-sm break-all">
                          {pairingCode}
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-2 text-center">
                        <QrCodeIcon className="w-12 h-12 text-muted-foreground/30" />
                        <p className="text-sm font-medium text-muted-foreground">{error || "QR code indisponível"}</p>
                      </div>
                    )}
                  </div>

                  {/* Instructions */}
                  {qrImage && (
                    <ol className="text-xs text-muted-foreground space-y-1 list-decimal list-inside">
                      <li>Abra o WhatsApp no seu celular</li>
                      <li>Toque em <strong>Aparelhos conectados</strong></li>
                      <li>Toque em <strong>Conectar aparelho</strong></li>
                      <li>Aponte a câmera para o QR code acima</li>
                    </ol>
                  )}

                  {/* Actions */}
                  <div className="flex gap-2">
                    <button
                      onClick={handleReconnect}
                      disabled={loadingQr || connecting}
                      className="flex-1 flex items-center justify-center gap-2 py-2.5 border border-border rounded-lg text-sm font-medium hover:bg-muted disabled:opacity-50 transition-colors"
                    >
                      <RotateCcw className={`w-4 h-4 ${connecting ? "animate-spin" : ""}`} />
                      Reconectar / Novo QR
                    </button>
                    <button
                      onClick={() => fetchQr()}
                      disabled={loadingQr || connecting}
                      className="flex items-center justify-center gap-2 px-3 py-2.5 border border-border rounded-lg hover:bg-muted disabled:opacity-50 transition-colors"
                      title="Atualizar"
                    >
                      <RefreshCw className={`w-4 h-4 ${loadingQr ? "animate-spin" : ""}`} />
                    </button>
                  </div>
                </>
              )}
            </>
          )}

          {tab === "history" && (
            <>
              <div className="rounded-xl bg-muted/40 border border-border p-3">
                <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">Última atividade bem-sucedida</p>
                <p className="text-sm">
                  {lastSuccess
                    ? new Date(lastSuccess.created_date).toLocaleString("pt-BR")
                    : "Nenhuma registrada ainda"}
                </p>
              </div>

              <div className="space-y-2 max-h-72 overflow-y-auto">
                {loadingHistory ? (
                  <p className="text-center text-sm text-muted-foreground py-4">Carregando...</p>
                ) : history.length === 0 ? (
                  <p className="text-center text-sm text-muted-foreground py-4">Sem histórico</p>
                ) : history.map((h) => (
                  <div key={h.id} className="flex items-start gap-2 p-2.5 border border-border rounded-lg">
                    {h.status === "sucesso"
                      ? <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                      : <XCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />}
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">{h.action} — {h.status}</p>
                      {h.details && <p className="text-xs text-muted-foreground truncate">{h.details}</p>}
                      <p className="text-xs text-muted-foreground">{new Date(h.created_date).toLocaleString("pt-BR")}</p>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}