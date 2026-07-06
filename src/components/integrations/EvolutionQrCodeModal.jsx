import React, { useState, useEffect } from "react";
import { evolutionApi } from "@/functions/evolutionApi";
import { useToast } from "@/components/ui/use-toast";
import { X, RefreshCw, QrCode as QrCodeIcon } from "lucide-react";

export default function EvolutionQrCodeModal({ onClose }) {
  const [instances, setInstances] = useState([]);
  const [selected, setSelected] = useState("");
  const [qrImage, setQrImage] = useState(null);
  const [loadingInstances, setLoadingInstances] = useState(true);
  const [loadingQr, setLoadingQr] = useState(false);
  const { toast } = useToast();

  useEffect(() => { loadInstances(); }, []);
  useEffect(() => { if (selected) loadQrCode(selected); }, [selected]);

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

        <div className="p-5 space-y-4">
          {loadingInstances ? (
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
          )}
        </div>
      </div>
    </div>
  );
}