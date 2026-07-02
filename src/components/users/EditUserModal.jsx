import React, { useState } from "react";
import { X, Save } from "lucide-react";

const SECTORS = ["Comercial", "Suporte Técnico", "Financeiro", "Cobrança", "Retenção", "Pós-venda", "Ouvidoria", "NOC", "Administrativo"];

export default function EditUserModal({ user, profiles, onSave, onClose }) {
  const [form, setForm] = useState({
    profile_key: user.profile_key || "",
    sector: user.sector || "",
    status: user.status || "ativo",
  });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    await onSave(user.id, form);
    setSaving(false);
  };

  const field = "w-full h-10 px-3 bg-muted/60 rounded-lg text-sm border border-transparent focus:border-primary focus:bg-card focus:outline-none transition-colors";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="bg-card rounded-2xl border border-border shadow-xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div>
            <h3 className="font-semibold font-heading">Editar Usuário</h3>
            <p className="text-xs text-muted-foreground">{user.full_name || user.email}</p>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-muted rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="text-sm font-medium mb-1.5 block">Perfil de permissões</label>
            <select value={form.profile_key} onChange={(e) => setForm({ ...form, profile_key: e.target.value })} className={field}>
              <option value="">Selecione um perfil</option>
              {profiles.map((p) => (
                <option key={p.id} value={p.key}>{p.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-sm font-medium mb-1.5 block">Setor</label>
            <select value={form.sector} onChange={(e) => setForm({ ...form, sector: e.target.value })} className={field}>
              <option value="">Selecione um setor</option>
              {SECTORS.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-sm font-medium mb-1.5 block">Status</label>
            <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className={field}>
              <option value="ativo">Ativo</option>
              <option value="inativo">Inativo</option>
            </select>
          </div>
          <div className="flex items-center gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 h-10 border border-border rounded-lg text-sm font-medium hover:bg-muted transition-colors">
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 h-10 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <Save className="w-4 h-4" /> {saving ? "Salvando..." : "Salvar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}