import React, { useState, useEffect } from "react";
import { zapsignApi } from "@/functions/zapsignApi";
import {
  FileSignature, Clock, CheckCircle, XCircle, AlertTriangle, ExternalLink,
} from "lucide-react";

/**
 * Banner de alerta que verifica se há contratos pendentes de assinatura ZapSign
 * para o telefone da conversa selecionada.
 */
export default function SignatureAlertBanner({ phone }) {
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!phone) { setDocs([]); return; }
    let cancelled = false;
    setLoading(true);
    zapsignApi({ action: "list_docs", search: phone, limit: 10 })
      .then((res) => {
        if (cancelled) return;
        const all = res?.data?.data || [];
        const phoneClean = String(phone).replace(/\D/g, "");
        const matched = all.filter((d) => {
          const dPhone = String(d.phone || "").replace(/\D/g, "");
          return dPhone === phoneClean || dPhone.endsWith(phoneClean) || phoneClean.endsWith(dPhone);
        });
        setDocs(matched);
      })
      .catch(() => { if (!cancelled) setDocs([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [phone]);

  if (loading || docs.length === 0) return null;

  const pending = docs.filter((d) => d.status === "pendente");
  const signed = docs.filter((d) => d.status === "assinado");
  const expired = docs.filter((d) => d.status === "expirado");
  const cancelled = docs.filter((d) => d.status === "cancelado");

  // Prioridade: pendente > expirado > cancelado > assinado
  if (pending.length > 0) {
    const doc = pending[0];
    const daysLeft = doc.expires_at ? Math.ceil((new Date(doc.expires_at).getTime() - Date.now()) / 86400000) : null;
    return (
      <div className="rounded-xl border border-amber-300 bg-amber-50 p-3">
        <div className="flex items-start gap-2">
          <Clock className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold text-amber-800">Contrato pendente de assinatura</p>
            <p className="text-[11px] text-amber-700 mt-0.5">
              {doc.template_name || doc.document_type || "Documento"} enviado
              {daysLeft !== null && daysLeft >= 0 ? ` · expira em ${daysLeft}d` : " · expirado"}
            </p>
          </div>
          {doc.sign_url && (
            <a href={doc.sign_url} target="_blank" rel="noopener noreferrer"
              className="flex-shrink-0 rounded p-1 text-amber-700 hover:bg-amber-100" title="Abrir link">
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          )}
        </div>
      </div>
    );
  }

  if (expired.length > 0) {
    return (
      <div className="rounded-xl border border-red-300 bg-red-50 p-3">
        <div className="flex items-start gap-2">
          <XCircle className="h-4 w-4 text-red-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold text-red-800">Contrato expirado sem assinatura</p>
            <p className="text-[11px] text-red-700 mt-0.5">
              {expired[0].template_name || "Documento"} venceu em {expired[0].expires_at ? new Date(expired[0].expires_at).toLocaleDateString("pt-BR") : "—"}
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (signed.length > 0) {
    return (
      <div className="rounded-xl border border-emerald-300 bg-emerald-50 p-3">
        <div className="flex items-start gap-2">
          <CheckCircle className="h-4 w-4 text-emerald-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold text-emerald-800">Contrato assinado</p>
            <p className="text-[11px] text-emerald-700 mt-0.5">
              {signed[0].template_name || "Documento"} assinado em {signed[0].signed_date ? new Date(signed[0].signed_date).toLocaleDateString("pt-BR") : "—"}
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (cancelled.length > 0) {
    return (
      <div className="rounded-xl border border-gray-300 bg-gray-50 p-3">
        <div className="flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 text-gray-500 flex-shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold text-gray-700">Contrato cancelado</p>
            <p className="text-[11px] text-gray-600 mt-0.5">{cancelled[0].template_name || "Documento"}</p>
          </div>
        </div>
      </div>
    );
  }

  return null;
}