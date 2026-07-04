import React, { useState, useRef } from "react";
import { X } from "lucide-react";

const categories = [
  { key: "saudacao", label: "Saudação" },
  { key: "financeiro", label: "Financeiro" },
  { key: "cobranca", label: "Cobrança (Lembretes)" },
  { key: "suporte_tecnico", label: "Suporte Técnico" },
  { key: "comercial", label: "Comercial" },
  { key: "despedida", label: "Despedida" },
  { key: "outro", label: "Outro" },
];

const variables = [
  { token: "{{nome_cliente}}", label: "Nome do cliente" },
  { token: "{{valor}}", label: "Valor da fatura" },
  { token: "{{vencimento}}", label: "Data de vencimento" },
  { token: "{{link_boleto}}", label: "Link do boleto" },
];

export default function TemplateFormModal({ template, onClose, onSave }) {
  const [form, setForm] = useState({
    title: template?.title || "",
    content: template?.content || "",
    category: template?.category || "outro",
    shortcut: template?.shortcut || "",
  });
  const [saving, setSaving] = useState(false);
  const contentRef = useRef(null);

  const set = (field) => (e) => setForm({ ...form, [field]: e.target.value });

  const insertVariable = (token) => {
    const el = contentRef.current;
    if (!el) return;
    const start = el.selectionStart ?? form.content.length;
    const end = el.selectionEnd ?? form.content.length;
    const newContent = form.content.slice(0, start) + token + form.content.slice(end);
    setForm({ ...form, content: newContent });
    requestAnimationFrame(() => {
      el.focus();
      el.selectionStart = el.selectionEnd = start + token.length;
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.title || !form.content) return;
    setSaving(true);
    try {
      await onSave(form);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-card rounded-xl border border-border w-full max-w-md p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold font-heading">{template ? "Editar Template" : "Novo Template"}</h3>
          <button onClick={onClose} className="p-1 hover:bg-muted rounded-lg"><X className="w-4 h-4" /></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3">
          <input required placeholder="Título" value={form.title} onChange={set("title")} className="w-full px-3 py-2 border border-border rounded-lg text-sm" />
          <select value={form.category} onChange={set("category")} className="w-full px-3 py-2 border border-border rounded-lg text-sm">
            {categories.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
          </select>
          <input placeholder="Atalho (ex: /boasvindas)" value={form.shortcut} onChange={set("shortcut")} className="w-full px-3 py-2 border border-border rounded-lg text-sm" />
          <textarea ref={contentRef} required placeholder="Texto do template" rows={5} value={form.content} onChange={set("content")} className="w-full px-3 py-2 border border-border rounded-lg text-sm resize-none" />
          <div>
            <p className="text-xs text-muted-foreground mb-1.5">Variáveis automáticas:</p>
            <div className="flex flex-wrap gap-1.5">
              {variables.map((v) => (
                <button
                  key={v.token}
                  type="button"
                  onClick={() => insertVariable(v.token)}
                  title={v.label}
                  className="px-2 py-1 rounded-md text-xs font-mono bg-muted hover:bg-muted/70 text-muted-foreground"
                >
                  {v.token}
                </button>
              ))}
            </div>
          </div>
          <div className="flex gap-2 pt-2">
            <button type="button" onClick={onClose} className="flex-1 py-2 border border-border rounded-lg text-sm font-medium hover:bg-muted">Cancelar</button>
            <button type="submit" disabled={saving} className="flex-1 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-60">
              {saving ? "Salvando..." : "Salvar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}