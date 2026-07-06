import React, { useState, useEffect } from "react";
import { evolutionApi } from "@/functions/evolutionApi";
import { useToast } from "@/components/ui/use-toast";
import { X, Plus, Trash2, QrCode, RefreshCw, Smartphone } from "lucide-react";

export default function InstanceManagerModal({ onClose }) {
  const [instances, setInstances] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const [qrInstance, setQrInstance] = useState(null);
  const [qrImage, setQrImage] = useState(null);
  const [loadingQr, setLoadingQr] = useState(false);
  const [deletingName, setDeletingName] = useState(null);
  const { toast } = useToast();

  useEffect(() => { loadInstances(); }, []);

  const loadInstances = async () => {
    setLoading(true);
    try {
      const response = await evolutionApi({});
      setInstances(response?.data?.instances || []);
    } catch {
      setInstances([]);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    const instanceName = newName.trim();
    if (!instanceName || creating) return;
    setCreating(true);
    try {
      const response = await evolutionApi({ action: "create_instance", instanceName });
      if (response?.data?.error) {
        toast({ title: "Falha ao criar instância", variant: "destructive" });
        return;
      }
      toast({ title: "Instância criada com sucesso" });
      setNewName("");
      await loadInstances();
    } catch {
      toast({ title: "Erro ao criar instância", variant: "destructive" });
    } finally {
      setCreating(false);
    }
  };

  const handleShowQrCode = async (instanceName) => {
    setQrInstance(instanceName);
    setQrImage(null);
    setLoadingQr(true);
    try {
      const response = await evolutionApi({ action: "get_qrcode", instanceName });
      if (response?.data?.error) {
        toast({ title: "Falha ao obter QR code", variant: "destructive" });
        return;
      }
      const qr = response?.data?.qrcode || {};
      const base64 = (qr.base64 || qr.qrcode?.base64 || qr.code || "").split("|")[0] || null;
      setQrImage(base64);
    } catch {
      toast({ title: "Erro ao obter QR code", variant: "destructive" });
    } finally {
      setLoadingQr(false);
    }
  };

  const handleDelete = async (instanceName) => {
    if (deletingName) return;
    setDeletingName(instanceName);
    try {
      const response = await evolutionApi({ action: "delete_instance", instanceName });
      if (response?.data?.error) {
        toast({ title: "Falha ao excluir instância", variant: "destructive" });
        return;
      }
      toast({ title: "Instância excluída" });
      if (qrInstance === instanceName) { setQrInstance(null); setQrImage(null); }
      await loadInstances();
    } catch {
      toast({ title: "Erro ao excluir instância", variant: "destructive" });
    } finally {
      setDeletingName(null);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-card rounded-xl w-full max-w-lg max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between p-5 border-b border-border">
          <h3 className="font-semibold text-lg">Instâncias do WhatsApp</h3>
          <button onClick={onClose} className="p-1.5 hover:bg-muted rounded-lg">
            <X className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>

        <div className="p-5 border-b border-border flex gap-2">
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleCreate()}
            placeholder="Nome da nova instância"
            className="flex-1 h-9 px-3 bg-muted/60 rounded-lg text-sm focus:outline-none focus:bg-card focus:ring-1 focus:ring-primary"
          />
          <button
            onClick={handleCreate}
            disabled={creating || !newName.trim()}
            className="flex items-center gap-1.5 px-3 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50"
          >
            {creating ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            Adicionar
          </button>
        </div>

        <div className="flex-1 overflow-y-auto scrollbar-thin p-5">
          {loading ? (
            <p className="text-center text-sm text-muted-foreground py-6">Carregando instâncias...</p>
          ) : instances.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-6">Nenhuma instância cadastrada</p>
          ) : (
            <div className="space-y-2">
              {instances.map((inst) => {
                const name = inst.name || inst.instance?.instanceName || "";
                const state = inst.connectionStatus || inst.status || inst.instance?.state || "desconhecido";
                return (
                  <div key={name} className="border border-border rounded-lg">
                    <div className="flex items-center gap-3 p-3">
                      <div className="w-9 h-9 rounded-lg bg-green-50 flex items-center justify-center flex-shrink-0">
                        <Smartphone className="w-4 h-4 text-green-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{name}</p>
                        <p className="text-xs text-muted-foreground capitalize">{state}</p>
                      </div>
                      <button
                        onClick={() => handleShowQrCode(name)}
                        className="p-2 hover:bg-muted rounded-lg"
                        title="Ler QR Code"
                      >
                        <QrCode className="w-4 h-4 text-muted-foreground" />
                      </button>
                      <button
                        onClick={() => handleDelete(name)}
                        disabled={deletingName === name}
                        className="p-2 hover:bg-destructive/10 rounded-lg disabled:opacity-50"
                        title="Excluir instância"
                      >
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </button>
                    </div>
                    {qrInstance === name && (
                      <div className="border-t border-border p-4 flex flex-col items-center">
                        {loadingQr ? (
                          <p className="text-xs text-muted-foreground py-4">Gerando QR code...</p>
                        ) : qrImage ? (
                          <img
                            src={qrImage.startsWith("data:") ? qrImage : `data:image/png;base64,${qrImage}`}
                            alt={`QR Code ${name}`}
                            className="w-48 h-48 object-contain"
                          />
                        ) : (
                          <p className="text-xs text-muted-foreground py-4">QR code indisponível. Tente novamente.</p>
                        )}
                        <p className="text-xs text-muted-foreground mt-2 text-center">Escaneie com o WhatsApp para conectar "{name}"</p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}