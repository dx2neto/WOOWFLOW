import { useState, useEffect } from "react";
import { ixcApi } from "@/functions/ixcApi";

/**
 * Hook que busca automaticamente a pré-análise do cliente no IXCSoft
 * quando uma conversa é selecionada, usando o telefone como chave de busca.
 *
 * @param {object|null} conversation - Conversa selecionada
 * @returns {{ data: object|null, loading: boolean, error: string|null, refetch: Function }}
 */
export function useIxcPreAnalysis(conversation) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const phone = conversation?.phone;

  useEffect(() => {
    if (!phone) { setData(null); return; }
    let cancelled = false;
    setLoading(true);
    setError(null);
    ixcApi({ action: "pre_analise", search: phone })
      .then((resp) => {
        if (cancelled) return;
        if (resp?.success !== false && resp?.data) setData(resp.data);
        else { setData(null); setError(resp?.error || "Não encontrado"); }
      })
      .catch(() => { if (!cancelled) { setData(null); setError("Falha ao consultar IXC"); } })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [phone]);

  const refetch = () => {
    if (!phone) return;
    setLoading(true);
    ixcApi({ action: "pre_analise", search: phone })
      .then((resp) => {
        if (resp?.success !== false && resp?.data) setData(resp.data);
        else { setData(null); setError(resp?.error || "Não encontrado"); }
      })
      .catch(() => { setData(null); setError("Falha ao consultar IXC"); })
      .finally(() => setLoading(false));
  };

  return { data, loading, error, refetch };
}