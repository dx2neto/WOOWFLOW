import React, { useState, useEffect, useRef, useCallback } from "react";
import { evolutionApi } from "@/functions/evolutionApi";
import { useToast } from "@/components/ui/use-toast";
import {
  X, Plus, Trash2, QrCode, RefreshCw, Smartphone,
  Wifi, WifiOff, Loader2, LogOut, RotateCcw, CheckCircle, AlertCircle
} from "lucide-react";

// ── Status badge ─────────────────────────────────────────────────────────────
function StateBadge({ state }) {
  const cfg = {
    connected:    { label: "Conectado",    bg: "bg-green-100 text-green-700",  dot: "bg-green-500",  Icon: Wifi },
    connecting:   { label: "Aguard. QR",   bg: "bg-amber-100 text-amber-700",  dot: "bg-amber-400",  Icon: QrCode },
    disconnected: { label: "Desconectado", bg: "bg-red-100 text-red-600",      dot: "bg-red-500",    Icon: WifiOff },
    unknown:      { label: "Desconhecido", bg: "bg-gray-100 text-gray-600",    dot: "bg-gray-400",   Icon: AlertCircle },
  }[state] || { label: state, bg: "bg-gray-100 text-gray-600", dot: "bg-gray-400", Icon: AlertCircle };
  const { label, bg, dot, Icon } = cfg;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${bg}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${dot}`} />
      <Icon className="w-3 h-3" />
      {label}
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

// ── QR Code panel (inline por instância) ─────────────────────────────────────
function QrPanel({ instanceName, initialQr, onConnected }) {
  const { toast } = useToast();
  const [qrcode, setQrcode]     = useState(() => normalizeQrImage(initialQr?.base64 || initialQr));
  const [pairingCode, setPairingCode] = useState(initialQr?.code || null);
  const [loading, setLoading]   = useState(!initialQr);
  const [error, setError]       = useState(null);
  const [connecting, setConnecting] = useState(false);
  const intervalRef = useRef(null);

  const fetchQr = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      const res = await evolutionApi({ action: "get_qrcode", instanceName });
      const d = res?.data;
      if (d?.state === "connected") {
        setQrcode(null);
        setPairingCode(null);
        setError(null);
        onConnected?.();
        clearInterval(intervalRef.current);
        intervalRef.current = null;
        return;
      }

      if (d?.success) {
        const qr = qrPayloadFromResponse(d);
        const image = normalizeQrImage(qr?.base64);
        setQrcode(image);
        setPairingCode(qr?.code || null);
        // Se veio QR code, inicia polling para detectar quando conectar
        if ((image || qr?.code) && !intervalRef.current) {
          intervalRef.current = setInterval(() => checkStatus(), 5000);
        }
      } else {
        setError(evolutionErrorMessage(d, "QR code indisponível"));
        setQrcode(null);
        setPairingCode(null);
      }
    } catch {
      setError("Erro de conexão ao buscar QR code");
    } finally {
      setLoading(false);
    }
  }, [instanceName]);

  const checkStatus = useCallback(async () => {
    try {
      const res = await evolutionApi({ action: "get_instance_info", instanceName });
      const state = res?.data?.instance?.state;
      if (state === "connected") {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
        setQrcode(null);
        setPairingCode(null);
        onConnected?.();
        toast({ title: `✅ ${instanceName} conectado com sucesso!` });
      }
    } catch { /* silent */ }
  }, [instanceName, toast, onConnected]);

  const handleReconnect = async () => {
    setConnecting(true);
    setQrcode(null);
    setPairingCode(null);
    setError(null);
    try {
      const res = await evolutionApi({ action: "connect_instance", instanceName });
      const d = res?.data;
      if (d?.error || d?.success === false) {
        setError(evolutionErrorMessage(d, "Falha ao reconectar. Tente novamente."));
        return;
      }
      const qr = qrPayloadFromResponse(d);
      const image = normalizeQrImage(qr?.base64);
      if (d?.state === "connected") {
        onConnected?.();
        return;
      }
      if (image || qr?.code) {
        setQrcode(image);
        setPairingCode(qr?.code || null);
        if (!intervalRef.current) intervalRef.current = setInterval(() => checkStatus(), 5000);
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

  useEffect(() => {
    fetchQr(Boolean(initialQr));
    // Auto-refresh QR a cada 25s (QR expira em ~60s)
    const refreshTimer = setInterval(() => fetchQr(true), 25000);
    return () => {
      clearInterval(refreshTimer);
      clearInterval(intervalRef.current);
    };
  }, [fetchQr, initialQr]);

  return (
    <div className="border-t border-border p-4 bg-muted/10">
      <div className="flex flex-col items-center gap-3">
        {loading || connecting ? (
          <div className="flex flex-col items-center gap-2 py-4">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <p className="text-xs text-muted-foreground">{connecting ? "Reconectando..." : "Buscando QR code..."}</p>
          </div>
        ) : qrcode ? (
          <>
            <p className="text-xs font-semibold text-center">Escaneie com o WhatsApp</p>
            <img src={qrcode} alt={`QR ${instanceName}`} className="w-52 h-52 rounded-lg border border-border object-contain bg-white p-1" />
            <p className="text-[11px] text-muted-foreground text-center">Abra o WhatsApp → Aparelhos conectados → Conectar aparelho</p>
            <p className="text-[11px] text-amber-600 font-medium">QR atualiza automaticamente a cada 25 segundos</p>
          </>
        ) : pairingCode ? (
          <>
            <p className="text-xs font-semibold text-center">Código de pareamento</p>
            <div className="rounded-lg border border-border bg-background px-3 py-2 font-mono text-sm break-all">
              {pairingCode}
            </div>
            <p className="text-[11px] text-muted-foreground text-center">Use este código no WhatsApp para concluir a conexão.</p>
          </>
        ) : (
          <div className="flex flex-col items-center gap-2 py-2 text-center">
            <AlertCircle className="w-7 h-7 text-amber-500" />
            <p className="text-sm font-medium">{error || "QR code indisponível"}</p>
          </div>
        )}

        <button
          onClick={handleReconnect}
          disabled={loading || connecting}
          className="flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium hover:bg-muted disabled:opacity-50 transition-colors"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          {connecting ? "Reconectando..." : "Gerar novo QR code"}
        </button>
      </div>
    </div>
  );
}

// ── InstanceManagerModal ──────────────────────────────────────────────────────
export default function InstanceManagerModal({ onClose }) {
  const { toast } = useToast();
  const [instances, setInstances] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [newName, setNewName]     = useState("");
  const [creating, setCreating]   = useState(false);
  const [openQr, setOpenQr]       = useState(null);   // nome da instância com QR aberto
  const [actingOn, setActingOn]   = useState(null);   // nome da instância em ação
  const [newInstQr, setNewInstQr] = useState(null);   // QR logo após criar instância
  const [loadError, setLoadError] = useState(null);

  const loadInstances = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await evolutionApi({ action: "list_instances" });
      if (res?.data?.error || res?.data?.success === false) {
        setInstances([]);
        setLoadError(evolutionErrorMessage(res.data, "Falha ao carregar instâncias"));
        return;
      }
      setInstances(res?.data?.instances || []);
    } catch {
      setInstances([]);
      setLoadError("Erro ao carregar instâncias da Evolution Go");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadInstances(); }, [loadInstances]);

  const handleCreate = async () => {
    const name = newName.trim();
    if (!name || creating) return;
    setCreating(true);
    setNewInstQr(null);
    try {
      const res = await evolutionApi({ action: "create_instance", instanceName: name });
      if (res?.data?.success) {
        toast({ title: `Instância "${name}" criada` });
        setNewName("");
        await loadInstances();
        // Se veio QR code na criação, exibe-o
        const qr = qrPayloadFromResponse(res.data);
        if (qr?.base64 || qr?.code) {
          setNewInstQr({ name, qrcode: qr });
          setOpenQr(name);
        } else {
          setOpenQr(name); // abre painel de QR mesmo assim para buscar
        }
      } else {
        toast({ title: evolutionErrorMessage(res?.data, "Falha ao criar instância"), variant: "destructive" });
      }
    } catch {
      toast({ title: "Erro ao criar instância", variant: "destructive" });
    } finally {
      setCreating(false);
    }
  };

  const handleLogout = async (name) => {
    if (actingOn) return;
    setActingOn(name);
    try {
      const res = await evolutionApi({ action: "logout_instance", instanceName: name });
      if (res?.data?.success) {
        toast({ title: `${name} desconectado` });
        await loadInstances();
      } else {
        toast({ title: evolutionErrorMessage(res?.data, "Falha ao desconectar"), variant: "destructive" });
      }
    } catch {
      toast({ title: "Erro ao desconectar", variant: "destructive" });
    } finally {
      setActingOn(null);
    }
  };

  const handleDelete = async (name) => {
    if (!confirm(`Excluir instância "${name}" permanentemente? Esta ação não pode ser desfeita.`)) return;
    if (actingOn) return;
    setActingOn(name);
    try {
      const res = await evolutionApi({ action: "delete_instance", instanceName: name });
      if (res?.data?.success) {
        toast({ title: `${name} excluída` });
        if (openQr === name) setOpenQr(null);
        await loadInstances();
      } else {
        toast({ title: evolutionErrorMessage(res?.data, "Falha ao excluir"), variant: "destructive" });
      }
    } catch {
      toast({ title: "Erro ao excluir", variant: "destructive" });
    } finally {
      setActingOn(null);
    }
  };

  const toggleQr = (name) => setOpenQr((prev) => prev === name ? null : name);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-card rounded-2xl w-full max-w-lg max-h-[90vh] flex flex-col shadow-2xl">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div>
            <h3 className="font-bold text-base">Instâncias WhatsApp</h3>
            <p className="text-xs text-muted-foreground">Evolution Go · {instances.length} instância{instances.length !== 1 ? "s" : ""}</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={loadInstances} disabled={loading} className="p-1.5 hover:bg-muted rounded-lg" title="Atualizar">
              <RefreshCw className={`w-4 h-4 text-muted-foreground ${loading ? "animate-spin" : ""}`} />
            </button>
            <button onClick={onClose} className="p-1.5 hover:bg-muted rounded-lg">
              <X className="w-4 h-4 text-muted-foreground" />
            </button>
          </div>
        </div>

        {/* Criar nova instância */}
        <div className="px-5 py-3 border-b border-border flex gap-2">
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value.replace(/\s/g, "_").toUpperCase())}
            onKeyDown={(e) => e.key === "Enter" && handleCreate()}
            placeholder="Nome da instância (ex: EMPRESA_01)"
            className="flex-1 h-9 px-3 bg-muted/60 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-primary font-mono"
          />
          <button
            onClick={handleCreate}
            disabled={creating || !newName.trim()}
            className="flex items-center gap-1.5 px-3 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50 whitespace-nowrap"
          >
            {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            {creating ? "Criando..." : "Criar"}
          </button>
        </div>

        {/* Lista de instâncias */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3 text-muted-foreground">
              <Loader2 className="w-6 h-6 animate-spin" />
              <p className="text-sm">Carregando instâncias...</p>
            </div>
          ) : loadError ? (
            <div className="flex flex-col items-center justify-center py-12 gap-2 text-center px-6">
              <AlertCircle className="w-10 h-10 text-amber-500" />
              <p className="text-sm font-semibold">Evolution Go indisponível</p>
              <p className="text-xs text-muted-foreground">{loadError}</p>
            </div>
          ) : instances.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-2 text-muted-foreground">
              <Smartphone className="w-10 h-10 opacity-30" />
              <p className="text-sm font-medium">Nenhuma instância criada</p>
              <p className="text-xs">Crie uma instância acima para começar</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {instances.map((inst) => {
                const name  = String(inst.name || "");
                const state = inst.state || "unknown";
                const isActing = actingOn === name;
                const isQrOpen = openQr === name;
                const isConnected = state === "connected";

                return (
                  <div key={name}>
                    {/* Row principal */}
                    <div className="flex items-center gap-3 px-5 py-3">
                      {/* Avatar */}
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${isConnected ? "bg-green-100" : "bg-muted"}`}>
                        {isConnected
                          ? <CheckCircle className="w-5 h-5 text-green-600" />
                          : <Smartphone className="w-4 h-4 text-muted-foreground" />}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-semibold text-sm font-mono truncate">{name}</p>
                          <StateBadge state={state} />
                        </div>
                        {inst.phone && <p className="text-xs text-muted-foreground">📱 {inst.phone}</p>}
                        {inst.profileName && inst.profileName !== name && (
                          <p className="text-xs text-muted-foreground">{inst.profileName}</p>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-1 flex-shrink-0">
                        {/* QR code button — só quando não conectado */}
                        {!isConnected && (
                          <button
                            onClick={() => toggleQr(name)}
                            className={`p-2 rounded-lg transition-colors ${isQrOpen ? "bg-primary/10 text-primary" : "hover:bg-muted text-muted-foreground"}`}
                            title="Ver QR Code"
                          >
                            <QrCode className="w-4 h-4" />
                          </button>
                        )}

                        {/* Logout button — só quando conectado */}
                        {isConnected && (
                          <button
                            onClick={() => handleLogout(name)}
                            disabled={isActing}
                            className="p-2 hover:bg-amber-50 rounded-lg disabled:opacity-50 transition-colors"
                            title="Desconectar"
                          >
                            {isActing ? <Loader2 className="w-4 h-4 animate-spin text-amber-600" /> : <LogOut className="w-4 h-4 text-amber-600" />}
                          </button>
                        )}

                        {/* Delete */}
                        <button
                          onClick={() => handleDelete(name)}
                          disabled={isActing}
                          className="p-2 hover:bg-red-50 rounded-lg disabled:opacity-50 transition-colors"
                          title="Excluir instância"
                        >
                          {isActing && actingOn !== name ? null : isActing
                            ? <Loader2 className="w-4 h-4 animate-spin text-red-500" />
                            : <Trash2 className="w-4 h-4 text-red-500" />}
                        </button>
                      </div>
                    </div>

                    {/* Painel QR inline */}
                    {isQrOpen && (
                      <QrPanel
                        instanceName={name}
                        initialQr={newInstQr?.name === name ? newInstQr.qrcode : null}
                        onConnected={async () => {
                          setOpenQr(null);
                          await loadInstances();
                        }}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer info */}
        <div className="px-5 py-3 border-t border-border bg-muted/10">
          <p className="text-[11px] text-muted-foreground text-center">
            Evolution Go · <span className="font-mono">CONNECT</span> · QR atualiza automaticamente · Status verifica a cada 5s após scan
          </p>
        </div>
      </div>
    </div>
  );
}
